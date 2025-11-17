import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { setToken, setAuthHeader } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

// Animations removed: use static components instead

type Props = { onLogin: (user: any) => void };

export default function LoginScreen({ onLogin }: Props): React.ReactElement {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const inputRefs = useRef<TextInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarText, setSnackbarText] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error' | 'info'>('info');
  const [resendTimer, setResendTimer] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const devCodeTimer = useRef<any>(null);

  // Keep refs used by inputs/timers; animations removed per request

  // Animations removed: keep screenWidth if needed for responsive layout
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    console.log('[LoginScreen] mounted');
  }, []);

  // animations removed: OTP visibility controlled by `otpSent` boolean

  // logo animation removed — keep static logo

  // phone input focus animation removed; keep simple focused state for styling
  const [phoneFocused, setPhoneFocused] = useState(false);

  useEffect(() => {
    let t: any;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => Math.max(0, s - 1)), 1000);
    }
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    setPhoneError('');
    setOtpError('');
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError('❌ Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/otp/request', { phone }); // Send only 10-digit number
      // API may return 401 or 403 with details; handle those inline
      setOtpSent(true);
      // If backend returns a code in non-production (helpful for dev/testing), show it briefly
      try {
        const code = res && res.data && res.data.code;
        if (code) {
          setDevOtpCode(String(code));
          // clear any previous timer
          if (devCodeTimer.current) clearTimeout(devCodeTimer.current);
          devCodeTimer.current = setTimeout(() => setDevOtpCode(null), 10000);
        }
      } catch (e) {}
      setResendTimer(20);
      setSnackbarType('success');
      setSnackbarText('OTP sent. Check your phone.');
      setSnackbarVisible(true);
      // hide snackbar automatically
      setTimeout(() => setSnackbarVisible(false), 3000);
    } catch (err: any) {
      const data = err && err.response && err.response.data;
      if (data && data.error === 'phone not registered') {
        setPhoneError('❌ This mobile number is not registered.');
      } else if (data && data.error === 'account deactivated') {
        setPhoneError('⚠️ Your account is deactivated. Please contact support.');
      } else {
        setPhoneError('❌ Failed to send OTP. Please try again later.');
      }
      setSnackbarType('error');
      setSnackbarText('Failed to send OTP');
      setSnackbarVisible(true);
      setTimeout(() => setSnackbarVisible(false), 3500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (devCodeTimer.current) clearTimeout(devCodeTimer.current);
    };
  }, []);

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setOtpError('❌ Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/otp/verify', { phone, code: otpCode }); // Only 10-digit number
      const { token, user } = res.data;
      await setToken(token);
      // ensure axios in-memory header is set immediately for subsequent requests
      try {
        setAuthHeader(token);
      } catch (e) {}
      onLogin({ ...user, token });
    } catch (err: any) {
      const data = err && err.response && err.response.data;
      if (data && data.error === 'invalid code') {
        setOtpError('❌ Incorrect OTP. Please try again.');
      } else if (data && data.error === 'code expired') {
        setOtpError('❌ OTP expired. Request a new one.');
      } else if (data && data.error === 'account deactivated') {
        setPhoneError('⚠️ Your account is deactivated. Please contact support.');
      } else {
        setOtpError('❌ Incorrect OTP. Please try again.');
      }
      setSnackbarType('error');
      setSnackbarText('OTP verification failed');
      setSnackbarVisible(true);
      setTimeout(() => setSnackbarVisible(false), 3000);
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

  // Animations removed

  return (
    <SafeAreaView style={styles.flexFill}>
      {/* Soft pink background to match reference */}
      <LinearGradient
        colors={['#fff1f3', '#fff9fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFull}
      />

      {/* Decorative blurred blobs (static) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
        style={{ flex: 1 }}
      >
        <View style={styles.pageContent}>
          {/* Centered logo/illustration area */}
          <View style={styles.logoWrap}>
            {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
            {(() => {
              try {
                const logoImg = require('../../assets/society-karbhar-logo.png');
                return <Image source={logoImg} style={styles.logo} />;
              } catch (e) {
                return (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoInitials}>SK</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.titlecentre}>Welcome back !</Text>
            <Text style={styles.subtitle}>Please Enter Your Mobile Number to Continue.</Text>
          </View>

          {/* When OTP is not sent, keep mobile input at bottom; when OTP is sent, show OTP panel centered */}
          {!otpSent ? (
            <View style={styles.bottomPanel}>
              <View style={styles.floatingLabelContainer}>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCodeSmall}>
                    {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
                    {(() => {
                      try {
                        const local = require('../../assets/flags/in.png');
                        return <Image source={local} style={styles.flagSmall} />;
                      } catch (e) {
                        return <Text style={styles.flagEmoji}>🇮🇳</Text>;
                      }
                    })()}
                    <Text style={styles.countryTextSmall}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.inputUnderline, phoneError ? styles.inputError : {}]}
                    placeholder="Mobile number"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onChangeText={setPhone}
                    value={phone}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                  />
                </View>
              </View>
              {phoneError ? (
                <Text style={styles.inlineError}>{phoneError}</Text>
              ) : (
                <View style={{ height: 8 }} />
              )}

              <TouchableOpacity
                style={[styles.primaryButtonPink, loading ? styles.buttonDisabled : {}]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonPinkText}>CONTINUE</Text>
                )}
              </TouchableOpacity>

              {snackbarVisible && (
                <View
                  style={[
                    styles.snackbar,
                    snackbarType === 'error' ? styles.snackbarError : styles.snackbarSuccess,
                  ]}
                >
                  <Text style={styles.snackbarText}>{snackbarText}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.otpCenterPanel}>
              {devOtpCode && (
                <View style={styles.devOtpBox}>
                  <Text style={styles.devOtpText}>Dev OTP: {devOtpCode}</Text>
                </View>
              )}
              <Text style={styles.otpTitle}>Enter the 6-digit code</Text>
              <View style={styles.otpContainerModern}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref!;
                    }}
                    style={[
                      styles.otpInputModern,
                      focusedIndex === index ? styles.otpInputFocused : {},
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    onChangeText={(value) => handleOtpChange(value, index)}
                  />
                ))}
              </View>
              {otpError ? (
                <Text style={styles.inlineError}>{otpError}</Text>
              ) : (
                <View style={{ height: 8 }} />
              )}
              <TouchableOpacity
                style={[styles.primaryButtonPink, loading ? styles.buttonDisabled : {}]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonPinkText}>VERIFY OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1, backgroundColor: '#fdeff2' },
  gradientBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(180deg, #5b21b6 0%, #06b6d4 100%)',
    opacity: 0.95,
  },
  gradientFull: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  blob: { position: 'absolute', borderRadius: 200, opacity: 0.18 },
  blob1: {
    width: 320,
    height: 320,
    backgroundColor: '#ffffff',
    top: -80,
    left: -80,
    transform: [{ scale: 1.1 }],
    shadowColor: '#fff',
    shadowOpacity: 0.35,
    shadowRadius: 40,
  },
  blob2: {
    width: 260,
    height: 260,
    backgroundColor: '#06b6d4',
    bottom: -60,
    right: -60,
    opacity: 0.12,
    shadowColor: '#06b6d4',
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  containerScroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  pageContent: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 80,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  titleLeft: {
    fontSize: Platform.OS === 'ios' ? 28 : 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'left',
    marginBottom: Platform.OS === 'ios' ? 12 : 10,
    width: '100%',
    paddingHorizontal: 4,
  },
  card: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : '95%',
    borderRadius: Platform.OS === 'ios' ? 20 : 16,
    padding: Platform.OS === 'ios' ? 26 : 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0b1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardSignup: {
    marginTop: 36,
    paddingHorizontal: 18,
    paddingVertical: 22,
    backgroundColor: '#ffffff',
  },
  subtitle: { color: '#6b7280', fontSize: 13, marginBottom: 12, textAlign: 'left', width: '90%' },
  logo: { width: 180, height: 180, marginBottom: 22, borderRadius: 28 },
  logoWrap: { width: '100%', alignItems: 'center', marginTop: 8 },
  bottomPanel: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    backgroundColor: 'transparent',
  },
  logoPlaceholder: {
    width: 180,
    height: 180,
    marginBottom: 22,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  otpCenterPanel: {
    width: '100%',
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: { fontSize: 22, fontWeight: '800', color: '#4f46e5' },
  title: {
    fontSize: Platform.OS === 'ios' ? 28 : 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: Platform.OS === 'ios' ? 18 : 14,
    fontFamily: Platform.select({ ios: 'Inter', android: 'normal' }),
  },
  titlecentre: {
    fontSize: Platform.OS === 'ios' ? 28 : 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: Platform.OS === 'ios' ? 18 : 14,
    fontFamily: Platform.select({ ios: 'Inter', android: 'normal' }),
  },
  panel: { width: '100%', marginTop: 6 },
  floatingLabelContainer: { marginBottom: 6 },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    top: 14,
    color: 'rgba(15,23,42,0.6)',
    fontSize: 16,
    zIndex: 10,
  },
  floatingLabelSmall: { top: -10, fontSize: 12, color: '#0f172a' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  countryCodeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginRight: 8,
  },
  flagSmall: { width: 20, height: 14, marginRight: 6 },
  flagEmoji: { fontSize: 18, marginRight: 6 },
  countryTextSmall: { fontSize: 14, fontWeight: '600' },
  inputModern: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  inputError: { borderColor: '#ff4d4f' },
  inlineError: { color: '#ff4d4f', marginTop: 8, fontSize: 13 },
  primaryButton: {
    marginTop: 12,
    backgroundColor: 'linear-gradient(90deg,#4f46e5,#06b6d4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  buttonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  // Blue primary button (static)
  primaryButtonBlue: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  buttonBlueText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  otpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  otpContainerModern: {
    flexDirection: 'row',
    // center the OTP inputs horizontally and give some horizontal padding so they're visually centered
    justifyContent: 'center',
    paddingHorizontal: 12,
    width: '100%',
  },
  otpInputModern: {
    width: Platform.OS === 'ios' ? 48 : 42,
    height: Platform.OS === 'ios' ? 56 : 50,
    borderRadius: 12,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: Platform.OS === 'ios' ? 20 : 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginHorizontal: 4,
  },
  inputUnderline: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#fbb6ce',
    backgroundColor: 'transparent',
  },
  otpInputFocused: {
    borderColor: '#4f46e5',
    shadowColor: '#6c5ce7',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  resendText: { color: '#475569', fontWeight: '600' },
  snackbar: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  snackbarText: { color: '#fff', fontWeight: '600' },
  snackbarError: { backgroundColor: '#ef4444' },
  snackbarSuccess: { backgroundColor: '#10b981' },
  // Pink primary used in reference image
  primaryButtonPink: {
    marginTop: 18,
    backgroundColor: '#fb7185',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  buttonPinkText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  devOtpBox: {
    backgroundColor: 'rgba(15,23,42,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  devOtpText: { color: '#0f172a', fontWeight: '700' },
});
