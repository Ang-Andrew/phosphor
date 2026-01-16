package buffer

import (
	"sync"
	"testing"
)

func TestNewRingBuffer(t *testing.T) {
	tests := []struct {
		name         string
		capacity     int
		wantCapacity int
	}{
		{"positive capacity", 100, 100},
		{"zero capacity defaults", 0, 1000},
		{"negative capacity defaults", -1, 1000},
		{"large capacity", 10000, 10000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rb := NewRingBuffer[int](tt.capacity)
			if rb.Cap() != tt.wantCapacity {
				t.Errorf("Cap() = %d, want %d", rb.Cap(), tt.wantCapacity)
			}
			if rb.Len() != 0 {
				t.Errorf("Len() = %d, want 0", rb.Len())
			}
			if !rb.IsEmpty() {
				t.Error("IsEmpty() = false, want true")
			}
		})
	}
}

func TestPushAndGetAll(t *testing.T) {
	rb := NewRingBuffer[int](5)

	// Push items less than capacity
	for i := 1; i <= 3; i++ {
		rb.Push(i)
	}

	items := rb.GetAll()
	if len(items) != 3 {
		t.Errorf("GetAll() returned %d items, want 3", len(items))
	}

	for i, v := range items {
		if v != i+1 {
			t.Errorf("items[%d] = %d, want %d", i, v, i+1)
		}
	}
}

func TestPushOverflow(t *testing.T) {
	rb := NewRingBuffer[int](3)

	// Push more items than capacity
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	// Should only contain last 3 items: [3, 4, 5]
	items := rb.GetAll()
	if len(items) != 3 {
		t.Errorf("GetAll() returned %d items, want 3", len(items))
	}

	expected := []int{3, 4, 5}
	for i, v := range items {
		if v != expected[i] {
			t.Errorf("items[%d] = %d, want %d", i, v, expected[i])
		}
	}

	if !rb.IsFull() {
		t.Error("IsFull() = false, want true")
	}
}

func TestGetLast(t *testing.T) {
	rb := NewRingBuffer[int](5)
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	tests := []struct {
		name     string
		n        int
		expected []int
	}{
		{"last 2", 2, []int{4, 5}},
		{"last 5", 5, []int{1, 2, 3, 4, 5}},
		{"last 10 (more than count)", 10, []int{1, 2, 3, 4, 5}},
		{"last 0", 0, []int{}},
		{"last negative", -1, []int{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := rb.GetLast(tt.n)
			if len(items) != len(tt.expected) {
				t.Errorf("GetLast(%d) returned %d items, want %d", tt.n, len(items), len(tt.expected))
				return
			}
			for i, v := range items {
				if v != tt.expected[i] {
					t.Errorf("items[%d] = %d, want %d", i, v, tt.expected[i])
				}
			}
		})
	}
}

func TestGetLatest(t *testing.T) {
	rb := NewRingBuffer[string](3)

	// Empty buffer
	_, ok := rb.GetLatest()
	if ok {
		t.Error("GetLatest() on empty buffer should return false")
	}

	rb.Push("first")
	rb.Push("second")
	rb.Push("third")

	latest, ok := rb.GetLatest()
	if !ok {
		t.Error("GetLatest() returned false, want true")
	}
	if latest != "third" {
		t.Errorf("GetLatest() = %s, want 'third'", latest)
	}

	// After overflow
	rb.Push("fourth")
	latest, ok = rb.GetLatest()
	if latest != "fourth" {
		t.Errorf("GetLatest() = %s, want 'fourth'", latest)
	}
}

func TestPushBatch(t *testing.T) {
	rb := NewRingBuffer[int](5)

	rb.PushBatch([]int{1, 2, 3})
	if rb.Len() != 3 {
		t.Errorf("Len() = %d, want 3", rb.Len())
	}

	rb.PushBatch([]int{4, 5, 6, 7})
	// Should contain [3, 4, 5, 6, 7]
	items := rb.GetAll()
	expected := []int{3, 4, 5, 6, 7}

	if len(items) != 5 {
		t.Errorf("GetAll() returned %d items, want 5", len(items))
	}

	for i, v := range items {
		if v != expected[i] {
			t.Errorf("items[%d] = %d, want %d", i, v, expected[i])
		}
	}
}

func TestClear(t *testing.T) {
	rb := NewRingBuffer[int](5)
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	rb.Clear()

	if !rb.IsEmpty() {
		t.Error("IsEmpty() = false after Clear(), want true")
	}
	if rb.Len() != 0 {
		t.Errorf("Len() = %d after Clear(), want 0", rb.Len())
	}
	if rb.IsFull() {
		t.Error("IsFull() = true after Clear(), want false")
	}
}

func TestForEach(t *testing.T) {
	rb := NewRingBuffer[int](5)
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	var sum int
	rb.ForEach(func(item int) bool {
		sum += item
		return true
	})

	if sum != 15 {
		t.Errorf("ForEach sum = %d, want 15", sum)
	}

	// Test early termination
	var earlySum int
	rb.ForEach(func(item int) bool {
		earlySum += item
		return item < 3
	})

	if earlySum != 6 { // 1 + 2 + 3
		t.Errorf("ForEach with early termination sum = %d, want 6", earlySum)
	}
}

func TestStats(t *testing.T) {
	rb := NewRingBuffer[int](10)
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	stats := rb.Stats()
	if stats.Count != 5 {
		t.Errorf("Stats.Count = %d, want 5", stats.Count)
	}
	if stats.Capacity != 10 {
		t.Errorf("Stats.Capacity = %d, want 10", stats.Capacity)
	}
	if stats.Usage != 0.5 {
		t.Errorf("Stats.Usage = %f, want 0.5", stats.Usage)
	}
	if stats.IsFull {
		t.Error("Stats.IsFull = true, want false")
	}
}

func TestConcurrentAccess(t *testing.T) {
	rb := NewRingBuffer[int](100)
	var wg sync.WaitGroup

	// Concurrent writers
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(start int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				rb.Push(start*100 + j)
			}
		}(i)
	}

	// Concurrent readers
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				_ = rb.GetAll()
				_ = rb.GetLast(10)
				_, _ = rb.GetLatest()
				_ = rb.Stats()
			}
		}()
	}

	wg.Wait()

	// Should have capped at 100
	if rb.Len() != 100 {
		t.Errorf("Len() = %d after concurrent access, want 100", rb.Len())
	}
}

func TestGenericTypes(t *testing.T) {
	// Test with struct type
	type Event struct {
		ID   string
		Data string
	}

	rb := NewRingBuffer[Event](3)
	rb.Push(Event{ID: "1", Data: "first"})
	rb.Push(Event{ID: "2", Data: "second"})

	items := rb.GetAll()
	if len(items) != 2 {
		t.Errorf("GetAll() returned %d items, want 2", len(items))
	}
	if items[0].ID != "1" || items[1].ID != "2" {
		t.Error("Struct data not preserved correctly")
	}
}

func BenchmarkPush(b *testing.B) {
	rb := NewRingBuffer[int](1000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rb.Push(i)
	}
}

func BenchmarkGetAll(b *testing.B) {
	rb := NewRingBuffer[int](1000)
	for i := 0; i < 1000; i++ {
		rb.Push(i)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = rb.GetAll()
	}
}

func BenchmarkConcurrentPush(b *testing.B) {
	rb := NewRingBuffer[int](1000)
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			rb.Push(i)
			i++
		}
	})
}
