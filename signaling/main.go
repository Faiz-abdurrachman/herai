package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
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
