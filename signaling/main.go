package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type SignalMessage struct {
	Type    string          `json:"type"`
	Room    string          `json:"room,omitempty"`
	From    string          `json:"from,omitempty"`
	To      string          `json:"to,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	id   string
	room string
	hub  *Hub
	conn *websocket.Conn
	send chan SignalMessage
}

type Room struct {
	clients map[string]*Client
}

type RoomInfo struct {
	Room    string   `json:"room"`
	Clients int      `json:"clients"`
	Peers   []string `json:"peers"`
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	defaultPort := getenv("PORT", "8080")
	addr := flag.String("addr", ":"+defaultPort, "HTTP listen address")
	flag.Parse()

	hub := &Hub{rooms: make(map[string]*Room)}

	http.HandleFunc("/__app-auth", handleAppAuth)
	http.HandleFunc("/__app-logout", handleAppLogout)
	http.HandleFunc("/__gas", proxyGAS)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if serveStaticApp(w, r) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"service":"herai-signaling","endpoints":{"health":"/healthz","rooms":"/rooms","websocket":"/ws"}}`))
	})
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"service":"herai-signaling"}`))
	})
	http.HandleFunc("/rooms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":    true,
			"rooms": hub.roomInfos(),
		})
	})
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWS(hub, w, r)
	})

	log.Printf("HerAI signaling server listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade failed: %v", err)
		return
	}

	client := &Client{
		id:   r.URL.Query().Get("clientId"),
		room: r.URL.Query().Get("room"),
		hub:  hub,
		conn: conn,
		send: make(chan SignalMessage, 32),
	}
	if client.id == "" || client.room == "" {
		_ = conn.WriteJSON(SignalMessage{Type: "error", Payload: mustRaw(`{"message":"clientId and room are required"}`)})
		_ = conn.Close()
		return
	}

	hub.join(client)
	go client.writePump()
	client.readPump()
}

func (h *Hub) join(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := h.rooms[client.room]
	if room == nil {
		room = &Room{clients: make(map[string]*Client)}
		h.rooms[client.room] = room
	}

	var peers []string
	for id := range room.clients {
		peers = append(peers, id)
	}
	room.clients[client.id] = client

	client.send <- SignalMessage{Type: "joined", Room: client.room, From: "server", Payload: mustJSON(map[string]any{
		"clientId": client.id,
		"peers":    peers,
	})}

	for id, peer := range room.clients {
		if id == client.id {
			continue
		}
		peer.send <- SignalMessage{Type: "peer-joined", Room: client.room, From: client.id}
	}
}

func (h *Hub) leave(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := h.rooms[client.room]
	if room == nil {
		return
	}

	delete(room.clients, client.id)
	close(client.send)

	for _, peer := range room.clients {
		peer.send <- SignalMessage{Type: "peer-left", Room: client.room, From: client.id}
	}

	if len(room.clients) == 0 {
		delete(h.rooms, client.room)
	}
}

func (h *Hub) forward(message SignalMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	room := h.rooms[message.Room]
	if room == nil {
		return
	}

	if message.To != "" {
		if target := room.clients[message.To]; target != nil {
			target.send <- message
		}
		return
	}

	for id, client := range room.clients {
		if id == message.From {
			continue
		}
		client.send <- message
	}
}

func (h *Hub) roomInfos() []RoomInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	infos := make([]RoomInfo, 0, len(h.rooms))
	for id, room := range h.rooms {
		peers := make([]string, 0, len(room.clients))
		for clientID := range room.clients {
			peers = append(peers, clientID)
		}
		infos = append(infos, RoomInfo{
			Room:    id,
			Clients: len(room.clients),
			Peers:   peers,
		})
	}
	return infos
}

func (c *Client) readPump() {
	defer func() {
		c.hub.leave(c)
		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(1 << 20)
	_ = c.conn.SetReadDeadline(time.Now().Add(70 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(70 * time.Second))
		return nil
	})

	for {
		var message SignalMessage
		if err := c.conn.ReadJSON(&message); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("read error: %v", err)
			}
			return
		}
		if message.Room == "" {
			message.Room = c.room
		}
		message.From = c.id
		c.hub.forward(message)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteJSON(message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func mustJSON(value any) json.RawMessage {
	bytes, err := json.Marshal(value)
	if err != nil {
		return mustRaw(`{}`)
	}
	return bytes
}

func mustRaw(value string) json.RawMessage {
	return json.RawMessage(value)
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func serveStaticApp(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	if !hasAppAccess(r) {
		serveAccessGate(w, r)
		return true
	}

	staticRoot := getenv("HERAI_STATIC_ROOT", "./public")
	cleanPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
	if cleanPath == "." {
		cleanPath = "index.html"
	}
	if cleanPath == ".." || strings.HasPrefix(cleanPath, "../") {
		http.NotFound(w, r)
		return true
	}

	fullPath := filepath.Join(staticRoot, cleanPath)
	if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
		serveStaticFile(w, r, fullPath)
		return true
	}

	indexPath := filepath.Join(staticRoot, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		serveStaticFile(w, r, indexPath)
		return true
	}

	return false
}

func serveStaticFile(w http.ResponseWriter, r *http.Request, path string) {
	ext := strings.ToLower(filepath.Ext(path))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if ext == ".html" {
		w.Header().Set("Cache-Control", "no-store")
	} else if ext == ".js" || ext == ".css" {
		w.Header().Set("Cache-Control", "no-cache, max-age=0, must-revalidate")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	http.ServeFile(w, r, path)
}

func handleAppAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		serveAccessGate(w, r)
		return
	}

	password := ""
	contentType := strings.ToLower(r.Header.Get("Content-Type"))
	if strings.Contains(contentType, "application/json") {
		var payload struct {
			Password string `json:"password"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		password = payload.Password
	} else {
		_ = r.ParseForm()
		password = r.FormValue("password")
	}

	expected := getenv("APP_ACCESS_PASSWORD", "")
	if expected == "" || !hmac.Equal([]byte(password), []byte(expected)) {
		serveAccessGateWithError(w, r, "Password akses salah.")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "herai_app_access",
		Value:    appAccessToken(),
		Path:     "/",
		MaxAge:   12 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func handleAppLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "herai_app_access",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func hasAppAccess(r *http.Request) bool {
	if getenv("APP_ACCESS_PASSWORD", "") == "" {
		return true
	}
	cookie, err := r.Cookie("herai_app_access")
	if err != nil {
		return false
	}
	return hmac.Equal([]byte(cookie.Value), []byte(appAccessToken()))
}

func appAccessToken() string {
	secret := getenv("APP_ACCESS_PASSWORD", "")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte("herai-superapp-access-v1"))
	return hex.EncodeToString(mac.Sum(nil))
}

func serveAccessGate(w http.ResponseWriter, r *http.Request) {
	serveAccessGateWithError(w, r, "")
}

func serveAccessGateWithError(w http.ResponseWriter, r *http.Request, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusUnauthorized)
	errorBlock := ""
	if message != "" {
		errorBlock = `<p class="error">` + htmlEscape(message) + `</p>`
	}
	_, _ = w.Write([]byte(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HerAI Secure Access</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { align-items: center; background: #101828; display: flex; justify-content: center; margin: 0; min-height: 100vh; padding: 24px; }
    main { background: #fff; border: 1px solid #f2f4f7; border-radius: 8px; box-shadow: 0 30px 80px rgba(0,0,0,.28); max-width: 420px; padding: 28px; width: 100%; }
    h1 { color: #101828; font-size: 1.35rem; line-height: 1.2; margin: 0 0 8px; }
    p { color: #667085; font-size: .92rem; line-height: 1.55; margin: 0 0 18px; }
    label { color: #344054; display: block; font-size: .82rem; font-weight: 800; margin-bottom: 8px; }
    input { border: 1px solid #d0d5dd; border-radius: 8px; box-sizing: border-box; font-size: 1rem; margin-bottom: 14px; padding: 12px 13px; width: 100%; }
    button { background: #ff1493; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 900; padding: 12px 14px; width: 100%; }
    .error { background: #fee4e2; border-radius: 8px; color: #b42318; font-weight: 800; padding: 10px 12px; }
    small { color: #98a2b3; display: block; font-size: .74rem; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <h1>HerAI Secure Access</h1>
    <p>Masukkan password akses untuk membuka aplikasi dan asset internal.</p>
    ` + errorBlock + `
    <form method="post" action="/__app-auth">
      <label for="password">Access Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Masuk</button>
    </form>
    <small>Protected application gateway</small>
  </main>
</body>
</html>`))
}

func htmlEscape(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#039;")
	return replacer.Replace(value)
}

func proxyGAS(w http.ResponseWriter, r *http.Request) {
	setJSONHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !hasAppAccess(r) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": "App access required"})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, `{"status":"error","message":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	target := getenv("GAS_WEB_APP_URL", "")
	if target == "" {
		http.Error(w, `{"status":"error","message":"GAS_WEB_APP_URL is not configured"}`, http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"status":"error","message":"failed to read request body"}`, http.StatusBadRequest)
		return
	}
	if len(bytes.TrimSpace(body)) == 0 {
		body = []byte(`{}`)
	}

	status, responseBody, contentType, err := postToGAS(target, body)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": err.Error()})
		return
	}

	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.WriteHeader(status)
	_, _ = w.Write(responseBody)
}

func postToGAS(target string, body []byte) (int, []byte, string, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	req.Header.Set("Content-Type", "text/plain;charset=utf-8")

	res, err := client.Do(req)
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	defer res.Body.Close()

	if isRedirect(res.StatusCode) && res.Header.Get("Location") != "" {
		return getGASRedirect(client, res.Header.Get("Location"))
	}

	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	return res.StatusCode, responseBody, normalizeContentType(res.Header.Get("Content-Type")), nil
}

func getGASRedirect(client *http.Client, location string) (int, []byte, string, error) {
	req, err := http.NewRequest(http.MethodGet, location, nil)
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	res, err := client.Do(req)
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return http.StatusBadGateway, nil, "", err
	}
	return res.StatusCode, responseBody, normalizeContentType(res.Header.Get("Content-Type")), nil
}

func setJSONHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
}

func isRedirect(status int) bool {
	return status == http.StatusMovedPermanently ||
		status == http.StatusFound ||
		status == http.StatusSeeOther ||
		status == http.StatusTemporaryRedirect ||
		status == http.StatusPermanentRedirect
}

func normalizeContentType(value string) string {
	if value == "" || strings.Contains(strings.ToLower(value), "text/html") {
		return "application/json"
	}
	return value
}
