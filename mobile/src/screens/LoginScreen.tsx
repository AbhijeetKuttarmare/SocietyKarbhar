import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, ImageBackground } from 'react-native';
import api, { setToken, setAuthHeader } from '../services/api';

type Props = { onLogin: (user: any) => void };

export default function LoginScreen({ onLogin }: Props): JSX.Element {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const inputRefs = useRef<TextInput[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/otp/request', { phone }); // Send only 10-digit number
      setOtpSent(true);
      Alert.alert('Success', 'OTP sent. Please check your phone.');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send OTP. Please check the number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/otp/verify', { phone, code: otpCode }); // Only 10-digit number
  const { token, user } = res.data;
  await setToken(token);
    // ensure axios in-memory header is set immediately for subsequent requests
    try{ setAuthHeader(token); }catch(e){}
  onLogin({ ...user, token });
    } catch (err: any) {
      Alert.alert('Error', 'Incorrect OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (/^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < otp.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      if (!value && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80' }}
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.card}>
          <Image
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Real_estate_logo.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Society Karbhar</Text>

          {!otpSent ? (
            <>
              <View style={styles.phoneContainer}>
                <View style={styles.countryCode}>
                  <Image
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg' }}
                    style={styles.flag}
                  />
                  <Text style={styles.countryText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Mobile Number"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  placeholderTextColor="#999"
                  maxLength={10}
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.otpTitle}>Enter OTP</Text>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref!)}
                    style={styles.otpInput}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                  />
                ))}
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendButton} onPress={handleSendOtp}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, justifyContent: 'center', width: '100%' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    alignItems: 'center',
  },
  logo: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#4f46e5', textAlign: 'center', marginBottom: 24 },
  phoneContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, width: '100%' },
  countryCode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#f1f1f1', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  flag: { width: 24, height: 16, marginRight: 6 },
  countryText: { fontSize: 16, fontWeight: '500' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  otpTitle: { fontSize: 18, fontWeight: '500', marginBottom: 16 },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '90%' },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    width: 50,
    height: 50,
    textAlign: 'center',
    fontSize: 20,
    backgroundColor: '#f7f7f7',
  },
  resendButton: { marginTop: 12 },
  resendText: { color: '#4f46e5', fontWeight: '500' },
});
