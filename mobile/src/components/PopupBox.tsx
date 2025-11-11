import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  dismissable?: boolean; // show close button
  showFooter?: boolean; // show the footer area
  footerContent?: React.ReactNode; // custom footer content (overrides default primary button)
};

export default function PopupBox({
  visible,
  onClose,
  title,
  subtitle,
  children,
  primaryLabel = 'Next',
  onPrimary,
  dismissable = true,
  showFooter = true,
  footerContent,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {dismissable ? (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={22} color="#374151" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 12 }}>
              {children}
            </ScrollView>

            {showFooter ? (
              <View style={styles.footer}>
                {footerContent ? (
                  footerContent
                ) : (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      if (onPrimary) onPrimary();
                    }}
                  >
                    <Text style={styles.primaryText}>{primaryLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');
const CARD_MAX_WIDTH = Math.min(720, Math.round(width - 48));

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardWrap: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    // on Android elevation creates shadow; on iOS use shadow props
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    maxHeight: Math.round(height * 0.85),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  closeBtn: { padding: 8, marginLeft: 8 },
  content: { paddingHorizontal: 18 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    padding: 14,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
