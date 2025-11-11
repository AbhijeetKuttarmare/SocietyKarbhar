import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: any; // optional custom icon (require(...))
};

export default function ConfirmBox({
  visible,
  title,
  message,
  danger,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
}: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.rowTop}>
            <View style={[styles.iconWrap, danger ? styles.iconDanger : styles.iconSuccess]}>
              {icon ? <Image source={icon} style={styles.iconImg} /> : <View />}
            </View>
            <View style={{ flex: 1 }}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, danger ? styles.confirmDanger : styles.confirmPrimary]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconSuccess: { backgroundColor: 'rgba(16,185,129,0.12)' },
  iconDanger: { backgroundColor: 'rgba(239,68,68,0.12)' },
  iconImg: { width: 28, height: 28, resizeMode: 'contain' },
  title: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6 },
  message: { color: '#666', fontSize: 14 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 10,
  },
  cancelText: { color: '#111', fontWeight: '700' },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  confirmPrimary: { backgroundColor: '#ff7a00' },
  confirmDanger: { backgroundColor: '#ef4444' },
  confirmText: { color: '#fff', fontWeight: '800' },
});
