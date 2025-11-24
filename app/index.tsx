import { Toast } from '@/components/Toast';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const Ripple = ({ delay }: { delay: number }) => {
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, [delay, sv]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sv.value, [0, 0.1, 0.7, 1], [0, 0.6, 0.2, 0]),
    transform: [{ scale: interpolate(sv.value, [0, 1], [0, 1.5]) }],
  }));

  return <Animated.View style={[styles.ripple, animatedStyle]} />;
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // User name state
  const [name, setName] = useState('');
  const [tempName, setTempName] = useState('');
  const [hasName, setHasName] = useState(false);
  const [checkingName, setCheckingName] = useState(true);

  // Recipient phone state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const phoneInputRef = useRef<TextInput>(null);

  // Flashlight state
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Animation values
  const scale = useSharedValue(50); 
  const contentOpacity = useSharedValue(0);
  const buttonContentOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    checkName();
  }, []);

  useEffect(() => {
    if (!checkingName && hasName) {
      // Intro animation sequence
      scale.value = withSequence(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.exp) }),
        withRepeat(
          withSequence(
            withTiming(1.05, { duration: 1500 }),
            withTiming(1, { duration: 1500 })
          ),
          -1,
          true
        )
      );

      contentOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
      buttonContentOpacity.value = withDelay(1200, withTiming(1, { duration: 500 }));
      footerOpacity.value = withDelay(1500, withTiming(1, { duration: 800 }));
    }
  }, [checkingName, hasName, scale, contentOpacity, buttonContentOpacity, footerOpacity]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value
  }));

  const animatedButtonContentStyle = useAnimatedStyle(() => ({
    opacity: buttonContentOpacity.value
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
    transform: [{ translateY: interpolate(footerOpacity.value, [0, 1], [20, 0]) }]
  }));

  const checkName = async () => {
    try {
      const storedName = await AsyncStorage.getItem('user_name');
      const storedPhone = await AsyncStorage.getItem('user_phone');
      
      if (storedName) {
        setName(storedName);
        setHasName(true);
      }
      
      if (storedPhone) {
        setPhoneNumber(storedPhone);
      }
    } catch (e) {
      console.error('Error loading data', e);
    } finally {
      setCheckingName(false);
    }
  };

  const toggleFlashlight = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.error('Permissão negada', { description: 'Precisamos de permissão da câmera para usar a lanterna.' });
        return;
      }
    }

    setIsTorchOn(prev => !prev);
  };

  const saveName = async () => {
    if (!tempName.trim()) {
      Toast.error('Nome necessário', {
        description: 'Por favor, digite seu nome para continuar.'
      });
      return;
    }

    try {
      await AsyncStorage.setItem('user_name', tempName.trim());
      setName(tempName.trim());
      
      if (tempPhoneNumber.trim()) {
        await AsyncStorage.setItem('user_phone', tempPhoneNumber.trim());
        setPhoneNumber(tempPhoneNumber.trim());
      } else {
        await AsyncStorage.removeItem('user_phone');
        setPhoneNumber('');
      }
      
      setHasName(true);
      Toast.success('Dados salvos com sucesso!');
    } catch (error) {
      console.error(error);
      Toast.error('Erro', {
        description: 'Não foi possível salvar seus dados.'
      });
    }
  };

  const handleSendLocation = async () => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setLoading(true);
    setStatusMsg('Localizando você...');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.error('Permissão necessária', {
          description: 'Precisamos saber onde você está para enviar a localização.'
        });
        setLoading(false);
        setStatusMsg('');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      // Get Battery Level
      let batteryInfo = '';
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level !== -1) {
          const percentage = Math.round(level * 100);
          batteryInfo = ` (Bateria: ${percentage}%)`;
        }
      } catch (e) {
        console.log('Battery error', e);
      }

      // Google Maps Link
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      const message = `Olá, aqui é ${name}. Estou neste local: ${mapUrl}${batteryInfo}`;
      
      let whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      if (phoneNumber) {
        let cleanPhone = phoneNumber.replace(/\D/g, '');
        // Se o número tiver 10 ou 11 dígitos (sem DDI), adiciona o 55 do Brasil
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            cleanPhone = '55' + cleanPhone;
        }
        whatsappUrl += `&phone=${cleanPhone}`;
      }

      setStatusMsg('Abrindo WhatsApp...');

      // On Android 11+, canOpenURL requires specific manifest queries which might be missing.
      // It's safer to try opening it directly and catch the error on Android.
      if (Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (!canOpen) {
          Toast.error('Atenção', {
            description: 'O WhatsApp não parece estar instalado.'
          });
          return;
        }
      }

      try {
        await Linking.openURL(whatsappUrl);
        setStatusMsg('Pronto! Selecione o contato.');
        Toast.success('Abrindo WhatsApp...');
      } catch (err) {
        console.error('Error opening WhatsApp:', err);
        Toast.error('Atenção', {
          description: 'O WhatsApp não parece estar instalado.'
        });
      }

    } catch (error) {
      console.error(error);
      Toast.error('Erro', {
        description: 'Não conseguimos pegar sua localização. Tente novamente.'
      });
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const handlePhoneChange = (text: string) => {
    let numbers = text.replace(/\D/g, '');
    if (numbers.length > 11) numbers = numbers.substring(0, 11);

    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
    }
    setTempPhoneNumber(formatted);

    if (numbers.length === 11) {
      Keyboard.dismiss();
    }
  };

  const editSettings = () => {
    setTempName(name);
    setTempPhoneNumber(phoneNumber);
    setHasName(false);
  };

  const openGithub = () => {
    Linking.openURL('https://github.com/devkoalaa');
  };

  const Footer = ({ animated = false }: { animated?: boolean }) => {
    // If animated, we need to wrap the TouchableOpacity inside Animated.View to animate opacity/transform
    if (animated) {
      return (
        <Animated.View style={[styles.footer, animatedFooterStyle]}>
          <TouchableOpacity onPress={openGithub}>
             <Text style={styles.footerText}>developed by @devkoalaa</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <TouchableOpacity onPress={openGithub} style={styles.footer}>
        <Text style={styles.footerText}>developed by @devkoalaa</Text>
      </TouchableOpacity>
    );
  };

  if (checkingName) {
    return (
      <View style={[styles.container, { backgroundColor: '#25D366' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!hasName) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar style="dark" />
        <View style={styles.card}>
          <Ionicons name="person-circle-outline" size={80} color="#25D366" style={{ marginBottom: 20 }} />
          <Text style={styles.title}>Bem-vindo(a)!</Text>
          <Text style={styles.subtitle}>Como você quer que as pessoas te chamem?</Text>

          <TextInput
            style={styles.input}
            placeholder="Ex: Pai, Mãe, Seu João..."
            value={tempName}
            onChangeText={setTempName}
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => phoneInputRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Text style={[styles.subtitle, { marginBottom: 10, marginTop: 10 }]}>Número do destinatário (opcional)</Text>
          <TextInput
            ref={phoneInputRef}
            style={styles.input}
            placeholder="Ex: (11) 99999-9999"
            value={tempPhoneNumber}
            onChangeText={handlePhoneChange}
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            maxLength={15}
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveName}>
            <Text style={styles.saveButtonText}>Começar</Text>
            <Ionicons name="arrow-forward" size={24} color="#fff" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </View>
        <Footer />
      </KeyboardAvoidingView>
    );
  }

    return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.header, animatedContentStyle]}>
        <View style={{ alignItems: 'flex-end', width: '100%' }}>
            <TouchableOpacity onPress={editSettings} style={styles.headerContent}>
            <Ionicons name="person-circle" size={32} color="#666" />
            <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">Olá, {name}</Text>
            <Ionicons name="settings-outline" size={16} color="#999" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.content}>
        <Animated.View style={animatedContentStyle}>
          <Text style={styles.mainTitle}>{loading ? 'Buscando sinal...' : 'Precisa de ajuda?'}</Text>
          <Text style={styles.mainSubtitle}>
            {loading ? 'Aguarde enquanto pegamos sua localização exata' : 'Toque no botão verde para enviar sua localização pelo WhatsApp'}
          </Text>
        </Animated.View>

        <Pressable onPress={handleSendLocation} disabled={loading}>
          <Animated.View style={[styles.bigButton, animatedButtonStyle, loading && styles.loadingButton]}>
            {loading ? (
              <>
                <Ripple delay={0} />
                <Ripple delay={600} />
                <Ripple delay={1200} />
                <Ionicons name="location" size={64} color="#fff" style={styles.loadingIcon} />
                <Text style={styles.loadingText}>Encontrando...</Text>
              </>
            ) : (
              <Animated.View style={[{ alignItems: 'center' }, animatedButtonContentStyle]}>
                <Ionicons name="navigate-circle" size={80} color="#fff" />
                <Text style={styles.bigButtonText}>ENVIAR ONDE ESTOU</Text>
              </Animated.View>
            )}
          </Animated.View>
        </Pressable>

        {/* Hidden Camera for Flashlight */}
        {permission?.granted && (
          <CameraView 
            style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} 
            enableTorch={isTorchOn} 
          />
        )}

        {/*<Animated.View style={[styles.secondaryButtons, animatedContentStyle]}>
          <TouchableOpacity 
            style={[styles.secondaryButton, isTorchOn ? styles.torchButtonActive : styles.torchButtonInactive]} 
            onPress={toggleFlashlight}
          >
            <Ionicons name={isTorchOn ? "flashlight" : "flashlight-outline"} size={32} color={isTorchOn ? "#fff" : "#666"} />
            <Text style={[styles.secondaryButtonText, { color: isTorchOn ? "#fff" : "#666" }]}>
              {isTorchOn ? "LANTERNA LIGADA" : "LIGAR LANTERNA"}
            </Text>
          </TouchableOpacity>
        </Animated.View>*/}

        <Animated.Text style={[styles.statusText, animatedContentStyle]}>{statusMsg}</Animated.Text>
      </View>
      <Footer animated />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    width: '90%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: '#F5F7FA',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 20,
    color: '#333',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E1E4E8',
  },
  saveButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  header: {
    position: 'absolute',
    top: 60,
    right: 20,
    left: 20, // Garante que não ultrapasse a largura
    flexDirection: 'row',
    justifyContent: 'flex-end', // Mantém alinhado à direita mas permite flexibilidade
    alignItems: 'center',
    // backgroundColor: '#fff', // Removido fundo branco para não tapar textos se ficar grande
    // paddingVertical: 8,      // Removido padding
    // paddingHorizontal: 16,   // Removido padding
    // borderRadius: 20,        // Removido border
    // elevation: 2,            // Removido sombra
    // shadowColor: '#000',     // Removido sombra
    // shadowOpacity: 0.05,     // Removido sombra
    // shadowRadius: 5,         // Removido sombra
    zIndex: 10, // Garante que fique acima se necessário, mas sem fundo
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    maxWidth: '100%', // Limita a largura do conteúdo
  },
  headerText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1, // Permite que o texto encolha se necessário
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  mainSubtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 50,
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  bigButton: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 15,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    borderWidth: 8,
    borderColor: '#fff',
    overflow: 'visible', // Allow ripples to expand
  },
  loadingButton: {
    // Remove greyed out effect to keep it engaging
    // backgroundColor: '#20bd5a', 
  },
  disabledButton: {
    // Removed in favor of custom loading state
  },
  bigButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 15,
    textAlign: 'center',
    width: '80%',
  },
  secondaryButtons: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 50,
    width: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 2,
  },
  torchButtonActive: {
    backgroundColor: '#F1C40F', // Yellow for light
    borderColor: '#F39C12',
  },
  torchButtonInactive: {
    backgroundColor: '#fff', 
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    textTransform: 'uppercase',
  },
  loadingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusText: {
    marginTop: 40,
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    minHeight: 30,
  },
  ripple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  loadingIcon: {
    marginBottom: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    letterSpacing: 0.5,
  }
});
