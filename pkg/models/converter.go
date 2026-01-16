// Package models provides conversion utilities for OTLP protobuf types.
package models

import (
	"encoding/hex"
	"fmt"
	"time"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

// idCounter is used to generate unique IDs for telemetry items
var idCounter uint64

// generateID creates a unique ID for a telemetry item
func generateID(prefix string) string {
	idCounter++
	return fmt.Sprintf("%s-%d-%d", prefix, time.Now().UnixNano(), idCounter)
}

// ConvertResource converts an OTLP resource to our domain model.
func ConvertResource(res *resourcepb.Resource) Resource {
	if res == nil {
		return Resource{}
	}

	attrs := convertAttributes(res.Attributes)
	serviceName := extractServiceName(attrs)

	return Resource{
		Attributes:  attrs,
		ServiceName: serviceName,
	}
}

// extractServiceName finds the service.name attribute
func extractServiceName(attrs []Attribute) string {
	for _, attr := range attrs {
		if attr.Key == "service.name" {
			if s, ok := attr.Value.(string); ok {
				return s
			}
		}
	}
	return "unknown"
}

// ConvertInstrumentationScope converts an OTLP scope to our domain model.
func ConvertInstrumentationScope(scope *commonpb.InstrumentationScope) InstrumentationScope {
	if scope == nil {
		return InstrumentationScope{}
	}

	return InstrumentationScope{
		Name:       scope.Name,
		Version:    scope.Version,
		Attributes: convertAttributes(scope.Attributes),
	}
}

// convertAttributes converts OTLP attributes to our domain model.
func convertAttributes(attrs []*commonpb.KeyValue) []Attribute {
	if len(attrs) == 0 {
		return nil
	}

	result := make([]Attribute, 0, len(attrs))
	for _, kv := range attrs {
		result = append(result, Attribute{
			Key:   kv.Key,
			Value: convertAnyValue(kv.Value),
			Type:  getValueType(kv.Value),
		})
	}
	return result
}

// convertAnyValue converts an OTLP AnyValue to a Go interface{}.
func convertAnyValue(val *commonpb.AnyValue) interface{} {
	if val == nil {
		return nil
	}

	switch v := val.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return v.StringValue
	case *commonpb.AnyValue_IntValue:
		return v.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return v.DoubleValue
	case *commonpb.AnyValue_BoolValue:
		return v.BoolValue
	case *commonpb.AnyValue_ArrayValue:
		if v.ArrayValue == nil {
			return nil
		}
		arr := make([]interface{}, len(v.ArrayValue.Values))
		for i, elem := range v.ArrayValue.Values {
			arr[i] = convertAnyValue(elem)
		}
		return arr
	case *commonpb.AnyValue_KvlistValue:
		if v.KvlistValue == nil {
			return nil
		}
		m := make(map[string]interface{})
		for _, kv := range v.KvlistValue.Values {
			m[kv.Key] = convertAnyValue(kv.Value)
		}
		return m
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(v.BytesValue)
	default:
		return nil
	}
}

// getValueType returns a string representation of the value type.
func getValueType(val *commonpb.AnyValue) string {
	if val == nil {
		return "null"
	}

	switch val.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return "string"
	case *commonpb.AnyValue_IntValue:
		return "int"
	case *commonpb.AnyValue_DoubleValue:
		return "double"
	case *commonpb.AnyValue_BoolValue:
		return "bool"
	case *commonpb.AnyValue_ArrayValue:
		return "array"
	case *commonpb.AnyValue_KvlistValue:
		return "kvlist"
	case *commonpb.AnyValue_BytesValue:
		return "bytes"
	default:
		return "unknown"
	}
}

// ConvertSpan converts an OTLP span to our domain model.
func ConvertSpan(span *tracepb.Span, resource Resource, scope InstrumentationScope) Span {
	if span == nil {
		return Span{}
	}

	startTime := time.Unix(0, int64(span.StartTimeUnixNano))
	endTime := time.Unix(0, int64(span.EndTimeUnixNano))
	durationMs := float64(span.EndTimeUnixNano-span.StartTimeUnixNano) / 1e6

	return Span{
		ID:                     generateID("span"),
		TraceID:                hex.EncodeToString(span.TraceId),
		SpanID:                 hex.EncodeToString(span.SpanId),
		ParentSpanID:           hex.EncodeToString(span.ParentSpanId),
		TraceState:             span.TraceState,
		StartTimeUnixNano:      int64(span.StartTimeUnixNano),
		EndTimeUnixNano:        int64(span.EndTimeUnixNano),
		StartTime:              startTime,
		EndTime:                endTime,
		DurationMs:             durationMs,
		Name:                   span.Name,
		Kind:                   convertSpanKind(span.Kind),
		StatusCode:             convertStatusCode(span.Status),
		StatusMessage:          getStatusMessage(span.Status),
		Resource:               resource,
		InstrumentationScope:   scope,
		Attributes:             convertAttributes(span.Attributes),
		Events:                 convertSpanEvents(span.Events),
		Links:                  convertSpanLinks(span.Links),
		DroppedAttributesCount: span.DroppedAttributesCount,
		DroppedEventsCount:     span.DroppedEventsCount,
		DroppedLinksCount:      span.DroppedLinksCount,
		ReceivedAt:             time.Now(),
	}
}

// convertSpanKind converts an OTLP span kind to our domain model.
func convertSpanKind(kind tracepb.Span_SpanKind) SpanKind {
	switch kind {
	case tracepb.Span_SPAN_KIND_INTERNAL:
		return SpanKindInternal
	case tracepb.Span_SPAN_KIND_SERVER:
		return SpanKindServer
	case tracepb.Span_SPAN_KIND_CLIENT:
		return SpanKindClient
	case tracepb.Span_SPAN_KIND_PRODUCER:
		return SpanKindProducer
	case tracepb.Span_SPAN_KIND_CONSUMER:
		return SpanKindConsumer
	default:
		return SpanKindUnspecified
	}
}

// convertStatusCode converts an OTLP status to our domain model.
func convertStatusCode(status *tracepb.Status) StatusCode {
	if status == nil {
		return StatusCodeUnset
	}

	switch status.Code {
	case tracepb.Status_STATUS_CODE_OK:
		return StatusCodeOk
	case tracepb.Status_STATUS_CODE_ERROR:
		return StatusCodeError
	default:
		return StatusCodeUnset
	}
}

// getStatusMessage extracts the message from an OTLP status.
func getStatusMessage(status *tracepb.Status) string {
	if status == nil {
		return ""
	}
	return status.Message
}

// convertSpanEvents converts OTLP span events to our domain model.
func convertSpanEvents(events []*tracepb.Span_Event) []SpanEvent {
	if len(events) == 0 {
		return nil
	}

	result := make([]SpanEvent, 0, len(events))
	for _, e := range events {
		result = append(result, SpanEvent{
			Name:                   e.Name,
			TimestampUnixNano:      int64(e.TimeUnixNano),
			Timestamp:              time.Unix(0, int64(e.TimeUnixNano)),
			Attributes:             convertAttributes(e.Attributes),
			DroppedAttributesCount: e.DroppedAttributesCount,
		})
	}
	return result
}

// convertSpanLinks converts OTLP span links to our domain model.
func convertSpanLinks(links []*tracepb.Span_Link) []SpanLink {
	if len(links) == 0 {
		return nil
	}

	result := make([]SpanLink, 0, len(links))
	for _, l := range links {
		result = append(result, SpanLink{
			TraceID:                hex.EncodeToString(l.TraceId),
			SpanID:                 hex.EncodeToString(l.SpanId),
			TraceState:             l.TraceState,
			Attributes:             convertAttributes(l.Attributes),
			DroppedAttributesCount: l.DroppedAttributesCount,
		})
	}
	return result
}

// ConvertMetric converts an OTLP metric to our domain model.
func ConvertMetric(metric *metricspb.Metric, resource Resource, scope InstrumentationScope) Metric {
	if metric == nil {
		return Metric{}
	}

	m := Metric{
		ID:                   generateID("metric"),
		Name:                 metric.Name,
		Description:          metric.Description,
		Unit:                 metric.Unit,
		Resource:             resource,
		InstrumentationScope: scope,
		ReceivedAt:           time.Now(),
	}

	switch data := metric.Data.(type) {
	case *metricspb.Metric_Gauge:
		m.Type = MetricTypeGauge
		m.DataPoints = convertNumberDataPoints(data.Gauge.DataPoints)
	case *metricspb.Metric_Sum:
		m.Type = MetricTypeSum
		m.AggregationTemporality = convertAggregationTemporality(data.Sum.AggregationTemporality)
		m.DataPoints = convertNumberDataPoints(data.Sum.DataPoints)
	case *metricspb.Metric_Histogram:
		m.Type = MetricTypeHistogram
		m.AggregationTemporality = convertAggregationTemporality(data.Histogram.AggregationTemporality)
		m.DataPoints = convertHistogramDataPoints(data.Histogram.DataPoints)
	case *metricspb.Metric_Summary:
		m.Type = MetricTypeSummary
		m.DataPoints = convertSummaryDataPoints(data.Summary.DataPoints)
	case *metricspb.Metric_ExponentialHistogram:
		m.Type = MetricTypeExponentialHistogram
		m.AggregationTemporality = convertAggregationTemporality(data.ExponentialHistogram.AggregationTemporality)
		// Simplified handling for exponential histograms
		m.DataPoints = []DataPoint{}
	}

	return m
}

// convertAggregationTemporality converts OTLP temporality to string.
func convertAggregationTemporality(at metricspb.AggregationTemporality) string {
	switch at {
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA:
		return "delta"
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE:
		return "cumulative"
	default:
		return "unspecified"
	}
}

// convertNumberDataPoints converts OTLP number data points.
func convertNumberDataPoints(dps []*metricspb.NumberDataPoint) []DataPoint {
	if len(dps) == 0 {
		return nil
	}

	result := make([]DataPoint, 0, len(dps))
	for _, dp := range dps {
		point := DataPoint{
			Attributes:        convertAttributes(dp.Attributes),
			StartTimeUnixNano: int64(dp.StartTimeUnixNano),
			TimeUnixNano:      int64(dp.TimeUnixNano),
			Timestamp:         time.Unix(0, int64(dp.TimeUnixNano)),
		}

		switch v := dp.Value.(type) {
		case *metricspb.NumberDataPoint_AsInt:
			point.ValueInt64 = &v.AsInt
		case *metricspb.NumberDataPoint_AsDouble:
			point.ValueDouble = &v.AsDouble
		}

		result = append(result, point)
	}
	return result
}

// convertHistogramDataPoints converts OTLP histogram data points.
func convertHistogramDataPoints(dps []*metricspb.HistogramDataPoint) []DataPoint {
	if len(dps) == 0 {
		return nil
	}

	result := make([]DataPoint, 0, len(dps))
	for _, dp := range dps {
		count := dp.Count
		sum := dp.Sum
		
		point := DataPoint{
			Attributes:        convertAttributes(dp.Attributes),
			StartTimeUnixNano: int64(dp.StartTimeUnixNano),
			TimeUnixNano:      int64(dp.TimeUnixNano),
			Timestamp:         time.Unix(0, int64(dp.TimeUnixNano)),
			Count:             &count,
			Sum:               sum,
			BucketCounts:      dp.BucketCounts,
			ExplicitBounds:    dp.ExplicitBounds,
		}
		result = append(result, point)
	}
	return result
}

// convertSummaryDataPoints converts OTLP summary data points.
func convertSummaryDataPoints(dps []*metricspb.SummaryDataPoint) []DataPoint {
	if len(dps) == 0 {
		return nil
	}

	result := make([]DataPoint, 0, len(dps))
	for _, dp := range dps {
		count := dp.Count
		sum := dp.Sum

		quantiles := make([]QuantileValue, 0, len(dp.QuantileValues))
		for _, qv := range dp.QuantileValues {
			quantiles = append(quantiles, QuantileValue{
				Quantile: qv.Quantile,
				Value:    qv.Value,
			})
		}

		point := DataPoint{
			Attributes:        convertAttributes(dp.Attributes),
			StartTimeUnixNano: int64(dp.StartTimeUnixNano),
			TimeUnixNano:      int64(dp.TimeUnixNano),
			Timestamp:         time.Unix(0, int64(dp.TimeUnixNano)),
			Count:             &count,
			Sum:               &sum,
			QuantileValues:    quantiles,
		}
		result = append(result, point)
	}
	return result
}

// ConvertLogRecord converts an OTLP log record to our domain model.
func ConvertLogRecord(log *logspb.LogRecord, resource Resource, scope InstrumentationScope) LogRecord {
	if log == nil {
		return LogRecord{}
	}

	return LogRecord{
		ID:                     generateID("log"),
		TimeUnixNano:           int64(log.TimeUnixNano),
		ObservedTimeUnixNano:   int64(log.ObservedTimeUnixNano),
		Timestamp:              time.Unix(0, int64(log.TimeUnixNano)),
		ObservedTime:           time.Unix(0, int64(log.ObservedTimeUnixNano)),
		Body:                   convertAnyValue(log.Body),
		SeverityNumber:         int32(log.SeverityNumber),
		SeverityText:           log.SeverityText,
		Severity:               normalizeSeverity(int32(log.SeverityNumber)),
		TraceID:                hex.EncodeToString(log.TraceId),
		SpanID:                 hex.EncodeToString(log.SpanId),
		TraceFlags:             log.Flags,
		Resource:               resource,
		InstrumentationScope:   scope,
		Attributes:             convertAttributes(log.Attributes),
		DroppedAttributesCount: log.DroppedAttributesCount,
		ReceivedAt:             time.Now(),
	}
}

// normalizeSeverity converts OTLP severity number to our severity level.
func normalizeSeverity(num int32) SeverityLevel {
	switch {
	case num <= 0:
		return SeverityUnspecified
	case num <= 4:
		return SeverityTrace
	case num <= 8:
		return SeverityDebug
	case num <= 12:
		return SeverityInfo
	case num <= 16:
		return SeverityWarn
	case num <= 20:
		return SeverityError
	default:
		return SeverityFatal
	}
}
