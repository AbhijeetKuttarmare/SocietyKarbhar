import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Animated,
  Easing,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { setToken, setAuthHeader } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type Props = { onLogin: (user: any) => void };

export default function LoginScreen({ onLogin }: Props): JSX.Element {
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

  const fadeAnim = useRef(new Animated.Value(0)).current; // for transition between send/verify
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    console.log('[LoginScreen] mounted');
  }, []);

  useEffect(() => {
    // animate when otpSent toggles
    Animated.timing(fadeAnim, {
      toValue: otpSent ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [otpSent]);

  // logo entrance animation
  const logoAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  // phone input focus/floating label animation
  const phoneFocusAnim = useRef(new Animated.Value(phone ? 1 : 0)).current;
  const [phoneFocused, setPhoneFocused] = useState(false);
  useEffect(() => {
    Animated.timing(phoneFocusAnim, {
      toValue: phoneFocused || !!phone ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [phoneFocused, phone]);

  useEffect(() => {
    let t: any;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
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

  // Animated interpolations
  const slideX = fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [screenWidth, 0] });

  return (
    <SafeAreaView style={styles.flexFill}>
      <AnimatedLinearGradient
        colors={['#6D28D9', '#0ea5a0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFull}
      />

      {/* Decorative blurred blobs */}
      <Animated.View style={[styles.blob, styles.blob1]} />
      <Animated.View style={[styles.blob, styles.blob2]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.containerScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  {
                    translateX: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }),
                  },
                ],
              },
            ]}
          >
            {/* Lightweight placeholder logo to avoid remote image delays */}
            <Animated.View
              style={[
                styles.logoPlaceholder,
                {
                  transform: [
                    { scale: logoAnim },
                    {
                      rotate: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '6deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.logoInitials}>SK</Text>
            </Animated.View>
            <Animated.Text
              style={[
                styles.title,
                { opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
              ]}
            >
              Society Karbhar
            </Animated.Text>

            {/* Phone input / Send OTP panel */}
            <Animated.View
              style={[
                styles.panel,
                { opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
              ]}
              pointerEvents={otpSent ? 'none' : 'auto'}
            >
              <View style={styles.floatingLabelContainer}>
                {/* <Animated.Text style={[styles.floatingLabel, { transform: [{ translateY: phoneFocusAnim.interpolate({ inputRange:[0,1], outputRange: [0,-18] }) }, { scale: phoneFocusAnim.interpolate({ inputRange:[0,1], outputRange: [1,0.85] }) }], opacity: phoneFocusAnim } ]}>Mobile Number</Animated.Text> */}
                <View style={styles.phoneRow}>
                  <View style={styles.countryCodeSmall}>
                    <Image
                      source={{
                        uri: 'https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg',
                      }}
                      style={styles.flagSmall}
                    />
                    <Text style={styles.countryTextSmall}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.inputModern, phoneError ? styles.inputError : {}]}
                    placeholder="Enter mobile number"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(v) => {
                      setPhone(v.replace(/\D/g, ''));
                      setPhoneError('');
                    }}
                    maxLength={10}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                  />
                </View>
              </View>
              {phoneError ? (
                <Text style={styles.inlineError}>{phoneError}</Text>
              ) : (
                <View style={{ height: 16 }} />
              )}

              <TouchableOpacity
                style={[styles.primaryButton, loading ? styles.buttonDisabled : {}]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#7c3aed', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* OTP panel */}
            <Animated.View
              style={[
                styles.panel,
                { transform: [{ translateX: slideX }], opacity: fadeAnim, marginTop: 18 },
              ]}
              pointerEvents={otpSent ? 'auto' : 'none'}
            >
              <Text style={styles.otpTitle}>Enter the 6-digit code</Text>
              <View style={styles.otpContainerModern}>
                {otp.map((digit, index) => {
                  const isFocused = focusedIndex === index;
                  return (
                    <TextInput
                      key={index}
                      ref={(ref) => (inputRefs.current[index] = ref!)}
                      style={[styles.otpInputModern, isFocused ? styles.otpInputFocused : {}]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      onChangeText={(value) => handleOtpChange(value, index)}
                    />
                  );
                })}
              </View>
              {otpError ? (
                <Text style={styles.inlineError}>{otpError}</Text>
              ) : (
                <View style={{ height: 16 }} />
              )}

              <TouchableOpacity
                style={[styles.primaryButton, loading ? styles.buttonDisabled : {}]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#7c3aed', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
                <TouchableOpacity onPress={handleSendOtp} disabled={resendTimer > 0 || loading}>
                  <Text
                    style={[styles.resendText, resendTimer > 0 || loading ? { opacity: 0.4 } : {}]}
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Snackbar */}
            {snackbarVisible && (
              <Animated.View
                style={[
                  styles.snackbar,
                  snackbarType === 'error' ? styles.snackbarError : styles.snackbarSuccess,
                ]}
              >
                <Text style={styles.snackbarText}>{snackbarText}</Text>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1, backgroundColor: 'transparent' },
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
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
  logo: { width: 84, height: 84, marginBottom: 12, borderRadius: 18 },
  logoPlaceholder: {
    width: 84,
    height: 84,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
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
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
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
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
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
});
