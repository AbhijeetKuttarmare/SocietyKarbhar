import React from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet } from 'react-native';
import ProfileCard from './ProfileCard';

type Props = {
  profile: any;
  onChange: (patch: any) => void;
  onEditAvatar: () => Promise<void>;
  onCall?: (p: string) => void;
  onSave: () => Promise<void>;
  documents?: any[];
  pickAndUploadFile?: any;
  saveDocumentToServer?: any;
  uploadingDocId?: string | null;
};

export default function UserProfileForm({
  profile,
  onChange,
  onEditAvatar,
  onCall,
  onSave,
  documents,
  pickAndUploadFile,
  saveDocumentToServer,
  uploadingDocId,
}: Props) {
  return (
    <View>
      <ProfileCard
        name={profile?.name}
        phone={profile?.phone}
        email={profile?.email}
        address={profile?.address}
        imageUri={profile?.avatar || profile?.image}
        onEdit={async () => {
          try {
            await onEditAvatar();
          } catch (e) {
            console.warn('onEditAvatar failed', e);
          }
        }}
        onCall={(p) => onCall && onCall(p)}
      />

      <TextInput
        style={styles.input}
        value={profile?.name}
        onChangeText={(t) => onChange({ name: t })}
        placeholder="Name"
      />
      <TextInput
        style={styles.input}
        value={profile?.phone}
        onChangeText={(t) => onChange({ phone: t })}
        placeholder="Phone"
        keyboardType="phone-pad"
      />

      <Text style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}>
        Email address
      </Text>
      <TextInput
        style={styles.input}
        value={profile?.email}
        onChangeText={(t) => onChange({ email: t })}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}>
        Emergency contact number
      </Text>
      <TextInput
        style={styles.input}
        value={profile?.emergency_contact}
        onChangeText={(t) => onChange({ emergency_contact: t })}
        placeholder="Emergency contact"
        keyboardType="phone-pad"
      />

      <Text style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}>
        Permanent address
      </Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={profile?.address}
        onChangeText={(t) => onChange({ address: t })}
        placeholder="Permanent address"
        multiline
      />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button title="Save" onPress={onSave} />
      </View>

      {/* Documents upload/viewing (optional) */}
      {documents ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '800', marginBottom: 8 }}>Upload Document</Text>
          {(() => {
            const seen = new Set<string>();
            const deduped = (documents || []).filter((d: any) => {
              const key = String((d.title || d.name || '').toLowerCase()).trim();
              if (!key) return false;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            if (!deduped || deduped.length === 0)
              return <Text style={{ color: '#6b7280' }}>No documents uploaded</Text>;

            return deduped.map((d: any) => (
              <View
                key={d.id}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{d.title || d.name || 'Document'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={async () => {
                      if (!pickAndUploadFile || !saveDocumentToServer) return;
                      try {
                        const url = await pickAndUploadFile({ accept: '*/*' });
                        if (!url) return;
                        // optimistic update handled by parent via saveDocumentToServer
                        await saveDocumentToServer(
                          { title: d.title || d.name || 'Document', file_url: url },
                          d.id
                        );
                      } catch (e) {
                        console.warn('upload failed', e);
                        alert('Upload failed');
                      }
                    }}
                  >
                    <Text style={{ color: '#2563eb' }}>Upload</Text>
                  </TouchableOpacity>

                  {d && d.file_url ? (
                    <TouchableOpacity
                      style={{ padding: 8, marginLeft: 6 }}
                      onPress={() => {
                        // parent handles preview
                      }}
                    >
                      <Text style={{ color: '#2563eb' }}>View</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ));
          })()}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#e6eef8',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
});
