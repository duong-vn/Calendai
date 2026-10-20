import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { MeetingProposal } from '../types';

interface ProposalModalProps {
  proposal: MeetingProposal | null;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ProposalModal({
  proposal,
  visible,
  onConfirm,
  onCancel,
  isLoading,
}: ProposalModalProps) {
  if (!proposal) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>⚙️ XÁC NHẬN CUỘC HỌP</Text>
            <Text style={styles.badge}>CHRONO-CONFIRM</Text>
          </View>

          {/* Details */}
          <View style={styles.body}>
            <Text style={styles.label}>Tiêu đề:</Text>
            <Text style={styles.valueTitle}>{proposal.title}</Text>

            <Text style={styles.label}>Thời gian:</Text>
            <Text style={styles.value}>
              {new Date(proposal.start).toLocaleString('vi-VN')}
            </Text>

            {proposal.createMeet !== false && (
              <View style={styles.meetRow}>
                <Text style={styles.meetIcon}>📹</Text>
                <Text style={styles.meetLabel}>Tự động tạo link Google Meet</Text>
              </View>
            )}

            {proposal.attendees && proposal.attendees.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Khách mời:</Text>
                <Text style={styles.value}>{proposal.attendees.join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelText}>Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#09090b" size="small" />
              ) : (
                <Text style={styles.confirmText}>Tạo lịch ngay 📅</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#eab308',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 10,
    marginBottom: 12,
  },
  headerTitle: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 10,
    backgroundColor: '#27272a',
    color: '#a1a1aa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  body: {
    marginVertical: 4,
  },
  label: {
    color: '#71717a',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 6,
  },
  valueTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  value: {
    color: '#d4d4d8',
    fontSize: 13,
    marginTop: 2,
  },
  meetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#059669',
  },
  meetIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  meetLabel: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#27272a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  cancelText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1.5,
    backgroundColor: '#eab308',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmText: {
    color: '#09090b',
    fontSize: 13,
    fontWeight: '800',
  },
});
