import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Alert } from 'react-native';
import type { CalendarEvent } from '../types';

interface AgendaCardProps {
  event: CalendarEvent;
}

export function AgendaCard({ event }: AgendaCardProps) {
  const startTime = event.isAllDay ? 'Cả ngày' : new Date(event.start).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  });
  const endTime = event.isAllDay ? '' : new Date(event.end).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  });

  const handleOpenMeet = async () => {
    try {
      const url = new URL(event.hangoutLink || '');
      if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com') {
        throw new Error('Liên kết Google Meet không hợp lệ.');
      }
      await Linking.openURL(url.toString());
    } catch {
      Alert.alert('Không thể mở Google Meet', 'Vui lòng kiểm tra liên kết và thử lại.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.leftBorder} />
      <View style={styles.content}>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {startTime} {endTime ? `- ${endTime}` : ''}
          </Text>
          {event.hangoutLink && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenMeet}
              style={styles.meetBadge}
            >
              <Text style={styles.meetText}>Google Meet 🔗</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.summaryText}>{event.summary}</Text>
        {event.description ? (
          <Text style={styles.descText} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#27272a',
    marginVertical: 6,
    overflow: 'hidden',
  },
  leftBorder: {
    width: 4,
    backgroundColor: '#10b981',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  meetBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  meetText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '700',
  },
  summaryText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  descText: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
  },
});
