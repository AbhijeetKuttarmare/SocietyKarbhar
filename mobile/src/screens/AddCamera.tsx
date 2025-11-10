import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import AddCamera from './Admin/AddCamera';

type Props = { navigation?: any; route?: any };

export default function AddCameraScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <AddCamera
        onCancel={() => {
          try {
            if (navigation && navigation.goBack) return navigation.goBack();
          } catch (e) {}
        }}
        onSaved={(c: any) => {
          try {
            if (navigation && navigation.goBack) navigation.goBack();
          } catch (e) {}
        }}
      />
    </SafeAreaView>
  );
}
