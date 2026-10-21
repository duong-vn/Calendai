import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { CalendarEvent, MeetingProposal, AuthStatus } from './src/types';
import {
  fetchUpcomingEvents,
  fetchAuthStatus,
  confirmMeetingProposal,
} from './src/services/api';
import { AgendaCard } from './src/components/AgendaCard';
import { ProposalModal } from './src/components/ProposalModal';
import { VoiceAssistantBar } from './src/components/VoiceAssistantBar';

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeProposal, setActiveProposal] = useState<MeetingProposal | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [assistantNote, setAssistantNote] = useState<string>(
    'Đang kết nối máy chủ để tải lịch hôm nay...'
  );

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [authRes, eventsRes] = await Promise.all([
        fetchAuthStatus(),
        fetchUpcomingEvents(),
      ]);
      setAuth(authRes);
      if (eventsRes.error) {
        setAssistantNote(eventsRes.error);
      } else {
        setEvents(eventsRes.events.filter((event) => {
          const start = event.isAllDay ? event.start.slice(0, 10) : new Date(event.start).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          return start === today;
        }));
        setAssistantNote('Đã tải lịch hôm nay. Trò chuyện AI trên mobile chưa được kết nối.');
      }
    } catch {
      setAuth(null);
      setAssistantNote('Không thể kết nối máy chủ. Kiểm tra mạng và địa chỉ API.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUserMessage = async (_text: string) => {
    setAssistantNote('Trò chuyện AI trên mobile chưa được kết nối. Vui lòng dùng giao diện web để đề xuất và xác nhận lịch.');
  };

  const handleConfirmMeeting = async () => {
    if (!activeProposal) return;
    setIsConfirming(true);

    const result = await confirmMeetingProposal(undefined, activeProposal);
    setIsConfirming(false);

    if (result.success && result.event) {
      setEvents((prev) => [result.event!, ...prev]);
      setActiveProposal(null);
      Alert.alert('Thành công', 'Đã thêm cuộc họp vào Google Calendar!');
      setAssistantNote('Đã tạo cuộc họp và link Google Meet thành công! 📅');
    } else {
      Alert.alert('Chưa tạo được lịch', result.error || 'Vui lòng thử lại.');
      setAssistantNote('Chưa tạo được cuộc họp. Bản thảo được giữ lại để bạn thử lại.');
    }
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoTitle}>⚙️ CALENDAI</Text>
          <Text style={styles.tzText}>Hà Nội (GMT+7)</Text>
        </View>

        <View style={styles.authBadge}>
          <View
            style={[
              styles.authDot,
              { backgroundColor: auth?.authenticated ? '#22c55e' : '#eab308' },
            ]}
          />
          <Text style={styles.authText}>
            {auth?.authenticated ? 'Đã kết nối Google' : 'Chưa kết nối'}
          </Text>
        </View>
      </View>

      {/* Main Agenda Section (Option C) */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadData}
            tintColor="#eab308"
          />
        }
      >
        {/* Date & Counter Bar */}
        <View style={styles.dateBar}>
          <View>
            <Text style={styles.dateLabel}>HÔM NAY</Text>
            <Text style={styles.dateValue}>{todayStr.toUpperCase()}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{events.length} cuộc họp</Text>
          </View>
        </View>

        {/* Assistant Status Callout */}
        <View style={styles.assistantCallout}>
          <Text style={styles.assistantAvatar}>🤖</Text>
          <Text style={styles.assistantText}>{assistantNote}</Text>
        </View>

        {/* Agenda Events List */}
        <View style={styles.agendaSection}>
          <Text style={styles.sectionTitle}>LỊCH TRÌNH CHI TIẾT</Text>
          {events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>
                Hôm nay không có cuộc họp nào.
              </Text>
              <Text style={styles.emptySubtext}>
                Hãy nói hoặc nhập bên dưới để lên lịch mới.
              </Text>
            </View>
          ) : (
            events.map((evt) => <AgendaCard key={evt.id} event={evt} />)
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Voice Assistant Bar */}
      <VoiceAssistantBar
        onSendMessage={handleUserMessage}
        isLoading={false}
      />

      {/* Confirmation Modal */}
      <ProposalModal
        proposal={activeProposal}
        visible={Boolean(activeProposal)}
        onConfirm={handleConfirmMeeting}
        onCancel={() => setActiveProposal(null)}
        isLoading={isConfirming}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#27272a',
    backgroundColor: '#18181b',
  },
  logoTitle: {
    color: '#eab308',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tzText: {
    color: '#71717a',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  authDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  authText: {
    color: '#d4d4d8',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  dateBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateValue: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  assistantCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  assistantAvatar: {
    fontSize: 20,
  },
  assistantText: {
    flex: 1,
    color: '#d4d4d8',
    fontSize: 12,
    lineHeight: 18,
  },
  agendaSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 4,
  },
});
