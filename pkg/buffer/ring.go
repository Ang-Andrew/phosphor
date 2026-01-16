// Package buffer provides thread-safe, generic data structures for high-performance
// telemetry data storage with bounded memory usage.
package buffer

import (
	"sync"
)

// RingBuffer is a generic, thread-safe circular buffer implementation.
// It provides O(1) insertion and maintains a fixed maximum capacity,
// automatically evicting the oldest items when full.
type RingBuffer[T any] struct {
	mu       sync.RWMutex
	items    []T
	head     int  // Points to the next write position
	tail     int  // Points to the oldest item
	count    int  // Current number of items
	capacity int  // Maximum capacity
	full     bool // Indicates if the buffer has wrapped around
}

// NewRingBuffer creates a new RingBuffer with the specified capacity.
// The capacity must be greater than 0, otherwise it defaults to 1000.
func NewRingBuffer[T any](capacity int) *RingBuffer[T] {
	if capacity <= 0 {
		capacity = 1000
	}
	return &RingBuffer[T]{
		items:    make([]T, capacity),
		capacity: capacity,
	}
}

// Push adds an item to the buffer. If the buffer is full, the oldest item
// is overwritten. This operation is thread-safe and O(1).
func (rb *RingBuffer[T]) Push(item T) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.items[rb.head] = item
	rb.head = (rb.head + 1) % rb.capacity

	if rb.full {
		// Move tail forward since we're overwriting
		rb.tail = (rb.tail + 1) % rb.capacity
	} else {
		rb.count++
		if rb.count == rb.capacity {
			rb.full = true
		}
	}
}

// PushBatch adds multiple items to the buffer atomically.
// This is more efficient than calling Push multiple times for bulk inserts.
func (rb *RingBuffer[T]) PushBatch(items []T) {
	if len(items) == 0 {
		return
	}

	rb.mu.Lock()
	defer rb.mu.Unlock()

	for _, item := range items {
		rb.items[rb.head] = item
		rb.head = (rb.head + 1) % rb.capacity

		if rb.full {
			rb.tail = (rb.tail + 1) % rb.capacity
		} else {
			rb.count++
			if rb.count == rb.capacity {
				rb.full = true
			}
		}
	}
}

// GetAll returns a copy of all items in the buffer, ordered from oldest to newest.
// This operation is thread-safe and does not modify the buffer.
func (rb *RingBuffer[T]) GetAll() []T {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if rb.count == 0 {
		return []T{}
	}

	result := make([]T, rb.count)
	for i := 0; i < rb.count; i++ {
		idx := (rb.tail + i) % rb.capacity
		result[i] = rb.items[idx]
	}
	return result
}

// GetLast returns the last n items from the buffer, ordered from oldest to newest.
// If n is greater than the current count, all items are returned.
func (rb *RingBuffer[T]) GetLast(n int) []T {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if rb.count == 0 || n <= 0 {
		return []T{}
	}

	if n > rb.count {
		n = rb.count
	}

	result := make([]T, n)
	startIdx := (rb.tail + rb.count - n) % rb.capacity
	for i := 0; i < n; i++ {
		idx := (startIdx + i) % rb.capacity
		result[i] = rb.items[idx]
	}
	return result
}

// GetLatest returns the most recent item in the buffer.
// Returns the zero value and false if the buffer is empty.
func (rb *RingBuffer[T]) GetLatest() (T, bool) {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	var zero T
	if rb.count == 0 {
		return zero, false
	}

	latestIdx := (rb.head - 1 + rb.capacity) % rb.capacity
	return rb.items[latestIdx], true
}

// Len returns the current number of items in the buffer.
func (rb *RingBuffer[T]) Len() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.count
}

// Cap returns the maximum capacity of the buffer.
func (rb *RingBuffer[T]) Cap() int {
	return rb.capacity
}

// Clear removes all items from the buffer.
func (rb *RingBuffer[T]) Clear() {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	// Reset all fields
	rb.head = 0
	rb.tail = 0
	rb.count = 0
	rb.full = false
	
	// Clear the slice to allow GC to collect old items
	rb.items = make([]T, rb.capacity)
}

// IsFull returns true if the buffer has reached its capacity.
func (rb *RingBuffer[T]) IsFull() bool {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.full
}

// IsEmpty returns true if the buffer contains no items.
func (rb *RingBuffer[T]) IsEmpty() bool {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.count == 0
}

// ForEach iterates over all items in the buffer, calling fn for each item.
// Items are visited in order from oldest to newest.
// The iteration stops if fn returns false.
func (rb *RingBuffer[T]) ForEach(fn func(item T) bool) {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	for i := 0; i < rb.count; i++ {
		idx := (rb.tail + i) % rb.capacity
		if !fn(rb.items[idx]) {
			break
		}
	}
}

// Stats returns statistics about the buffer's current state.
type BufferStats struct {
	Count    int     `json:"count"`
	Capacity int     `json:"capacity"`
	Usage    float64 `json:"usage"` // Percentage 0.0-1.0
	IsFull   bool    `json:"isFull"`
}

func (rb *RingBuffer[T]) Stats() BufferStats {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	return BufferStats{
		Count:    rb.count,
		Capacity: rb.capacity,
		Usage:    float64(rb.count) / float64(rb.capacity),
		IsFull:   rb.full,
	}
}
