import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';

type ScanUI = {
  manualName: string;
  setManualName: (s: string) => void;
  manualWingLabel?: string;
  manualFlatLabel?: string;
  setShowWingModal?: (v: boolean) => void;
  setWingModalTarget?: (t: 'manual' | 'directory') => void;
  setFlatModalTarget?: (t: 'manual' | 'directory') => void;
  setShowFlatModal?: (v: boolean) => void;
  manualReason?: string;
  setManualReason?: (s: string) => void;
  manualPeople?: string;
  setManualPeople?: (s: string) => void;
  additionalVisitorsNames?: string;
  setAdditionalVisitorsNames?: (s: string) => void;
  selfieBase64?: string | null;
  pickSelfie?: () => Promise<void> | void;
  additionalSelfies?: string[];
  pickAdditionalSelfies?: () => Promise<void> | void;
  submitManualVisitor?: () => Promise<void> | void;
  submitting?: boolean;
  openFormLink?: () => void;
  fetchFlats?: (reset?: boolean) => Promise<void> | void;
};

type Props = { ui?: Partial<ScanUI>; styles?: any };

export default function SecurityGuardScan({ ui = {}, styles = {} }: Props) {
  const {
    manualName,
    setManualName,
    manualWingLabel,
    manualFlatLabel,
    setShowWingModal,
    setWingModalTarget,
    setFlatModalTarget,
    setShowFlatModal,
    manualReason,
    setManualReason,
    manualPeople,
    setManualPeople,
    additionalVisitorsNames,
    setAdditionalVisitorsNames,
    selfieBase64,
    pickSelfie,
    additionalSelfies,
    pickAdditionalSelfies,
    submitManualVisitor,
    submitting,
  } = ui as ScanUI;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Scan / New Visitor</Text>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => (typeof ui.openFormLink === 'function' ? ui.openFormLink() : null)}
      >
        <Text style={styles.actionText}>Scan QR (Open Form)</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 16 }}>
        <Text style={styles.label}>Visitor Name</Text>
        <TextInput style={styles.input} value={manualName} onChangeText={setManualName} />
        <Text style={styles.label}>Wing</Text>
        <TouchableOpacity
          style={[styles.input, { justifyContent: 'center' }]}
          onPress={() => (
            setWingModalTarget && setWingModalTarget('manual'),
            setShowWingModal && setShowWingModal(true)
          )}
        >
          <Text>{manualWingLabel || 'Select Wing'}</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Flat</Text>
        <TouchableOpacity
          style={[styles.input, { justifyContent: 'center' }]}
          onPress={async () => {
            setFlatModalTarget && setFlatModalTarget('manual');
            try {
              if (typeof ui.fetchFlats === 'function') await ui.fetchFlats(false);
            } catch (e) {}
            setShowFlatModal && setShowFlatModal(true);
          }}
        >
          <Text>{manualFlatLabel || 'Select Flat'}</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Reason</Text>
        <TextInput style={styles.input} value={manualReason} onChangeText={setManualReason} />
        <Text style={styles.label}>Number of People</Text>
        <TextInput
          style={styles.input}
          value={manualPeople}
          onChangeText={setManualPeople}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Names of Additional Visitors</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={additionalVisitorsNames}
          onChangeText={setAdditionalVisitorsNames}
          multiline
        />

        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Selfie</Text>
          {selfieBase64 ? (
            <Image
              source={{ uri: selfieBase64 }}
              style={{ width: 120, height: 120, borderRadius: 8 }}
            />
          ) : (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => pickSelfie && pickSelfie()}
            >
              <Text style={{ color: '#fff' }}>Take Photo</Text>
            </TouchableOpacity>
          )}

          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Selfies of Additional Visitors</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.cameraButton, { width: 120 }]}
                onPress={() => pickAdditionalSelfies && pickAdditionalSelfies()}
              >
                <Text style={{ color: '#fff' }}>Pick Photos</Text>
              </TouchableOpacity>
              <ScrollView horizontal>
                {additionalSelfies &&
                  additionalSelfies.map((s: string, i: number) => (
                    <Image
                      key={i}
                      source={{ uri: s }}
                      style={{ width: 64, height: 64, borderRadius: 6, marginLeft: 8 }}
                    />
                  ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => submitManualVisitor && submitManualVisitor()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff' }}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
