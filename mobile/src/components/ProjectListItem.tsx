import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

type Props = {
  title: string;
  subtitle?: string; // e.g. "John Doe | Lahore"
  tag?: string; // e.g. "(Commercial)"
  status?: string; // e.g. "Completed" | "Cancelled" | "On Going"
  amountLabel?: string; // e.g. "Total $234"
  amountSubLabel?: string; // e.g. "left $234"
  date?: string; // e.g. "Oct 2,2020"
  thumbnail?: string; // image uri
  onPress?: () => void;
  onPressMore?: () => void;
};

const statusStyles: Record<string, { color: string }> = {
  completed: { color: '#2ecc71' },
  cancelled: { color: '#e74c3c' },
  'on going': { color: '#3498db' },
  ongoing: { color: '#3498db' },
};

const ProjectListItem: React.FC<Props> = ({
  title,
  subtitle,
  tag,
  status,
  amountLabel,
  amountSubLabel,
  date,
  thumbnail,
  onPress,
  onPressMore,
}) => {
  const key = (status || '').toLowerCase();
  const sStyle = statusStyles[key] || { color: '#6c757d' };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.container}>
      <View style={styles.leftRow}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback} />
        )}

        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {tag ? <Text numberOfLines={1} style={styles.tag}>{` ${tag}`}</Text> : null}
          </View>

          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}

          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: sStyle.color }]}>{status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        {amountLabel ? <Text style={styles.amountLabel}>{amountLabel}</Text> : null}
        {amountSubLabel ? <Text style={styles.amountSubLabel}>{amountSubLabel}</Text> : null}
        {date ? <Text style={styles.date}>{date}</Text> : null}
        {onPressMore ? (
          <TouchableOpacity onPress={onPressMore} style={styles.moreBtn}>
            <Text style={styles.moreText}>⋮</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6e6e6',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#f2f2f2',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#dfe7ef',
  },
  texts: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  tag: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#777',
  },
  statusRow: {
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 90,
  },
  amountLabel: {
    color: '#2b86d8',
    fontSize: 13,
    fontWeight: '600',
  },
  amountSubLabel: {
    color: '#2b86d8',
    fontSize: 12,
  },
  date: {
    marginTop: 6,
    fontSize: 12,
    color: '#999',
  },
  moreBtn: {
    position: 'absolute',
    right: -8,
    top: -6,
    padding: 6,
  },
  moreText: {
    fontSize: 16,
    color: '#999',
  },
});

export default ProjectListItem;
