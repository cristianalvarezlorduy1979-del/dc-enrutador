import { Linking, Platform, Alert } from 'react-native';

/**
 * Abre la ruta directamente en Google Maps hacia la dirección del cliente.
 * En Android intenta usar la navegación paso a paso nativa de Google Maps.
 * Como alternativa universal, usa la URL oficial de Google Maps Directions.
 */
export const openRouteInGoogleMaps = async (address, city = '') => {
  if (!address || !address.trim()) {
    Alert.alert('Dirección vacía', 'Este cliente no tiene una dirección registrada.');
    return;
  }

  // Si se incluye ciudad, mejora la precisión del mapa
  const fullDestination = city && city.trim() ? `${address.trim()}, ${city.trim()}` : address.trim();
  const encodedDestination = encodeURIComponent(fullDestination);

  // 1. Intent para Android nativo (Abre Google Maps en modo navegación GPS paso a paso)
  if (Platform.OS === 'android') {
    const androidNavUri = `google.navigation:q=${encodedDestination}&mode=d`;
    try {
      const canOpen = await Linking.canOpenURL(androidNavUri);
      if (canOpen) {
        await Linking.openURL(androidNavUri);
        return;
      }
    } catch {
      // Continuar al plan B si falla el intent nativo
    }
  }

  // 2. URL Universal de Google Maps (funciona en Android, iOS y Navegador Web)
  const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
  
  try {
    const canOpenUniversal = await Linking.canOpenURL(universalUrl);
    if (canOpenUniversal) {
      await Linking.openURL(universalUrl);
    } else {
      Alert.alert(
        'No se pudo abrir Google Maps',
        'Por favor verifica que tengas la aplicación de Google Maps o un navegador web instalado.'
      );
    }
  } catch (error) {
    Alert.alert('Error al abrir ruta', error.message || 'Ocurrió un error al contactar con Google Maps.');
  }
};

/**
 * Realiza una llamada telefónica directa al número de contacto.
 */
export const makePhoneCall = async (phone) => {
  if (!phone || !phone.trim()) {
    Alert.alert('Sin teléfono', 'Este cliente no tiene un teléfono de contacto registrado.');
    return;
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const phoneUrl = `tel:${cleanPhone}`;

  try {
    const canOpen = await Linking.canOpenURL(phoneUrl);
    if (canOpen) {
      await Linking.openURL(phoneUrl);
    } else {
      Alert.alert('Aviso', `No es posible realizar llamadas en este dispositivo. Número: ${phone}`);
    }
  } catch (error) {
    Alert.alert('Error', 'No se pudo iniciar la llamada: ' + error.message);
  }
};

/**
 * Abre chat de WhatsApp con el cliente.
 */
export const openWhatsApp = async (phone, clientName = '') => {
  if (!phone || !phone.trim()) {
    Alert.alert('Sin teléfono', 'Este cliente no tiene un teléfono registrado.');
    return;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const greeting = clientName ? `Hola ${clientName}, ` : 'Hola, ';
  const message = encodeURIComponent(`${greeting}te contacto respecto a tu visita/entrega.`);
  const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

  try {
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
    } else {
      Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp en este dispositivo.');
    }
  } catch (error) {
    Alert.alert('Error', 'No se pudo abrir WhatsApp: ' + error.message);
  }
};
