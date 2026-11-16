import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function ClientModal({ visible, onClose, onSave, clientToEdit }) {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  const isEditing = !!clientToEdit;

  useEffect(() => {
    if (clientToEdit) {
      setFullName(clientToEdit.fullName || '');
      setCompanyName(clientToEdit.companyName || '');
      setPhone(clientToEdit.phone || '');
      setAddress(clientToEdit.address || '');
      setCity(clientToEdit.city || '');
      setNotes(clientToEdit.notes || '');
    } else {
      setFullName('');
      setCompanyName('');
      setPhone('');
      setAddress('');
      setCity('');
      setNotes('');
    }
  }, [clientToEdit, visible]);

  const handleSave = () => {
    if (!fullName.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa el nombre completo del cliente.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa la dirección para la ruta en Google Maps.');
      return;
    }

    onSave({
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isEditing ? 'Modifica los datos del cliente' : 'Ingresa la información y dirección del cliente'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Formulario */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Nombre Completo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Nombre Completo <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Carlos Alberto Gómez"
                  placeholderTextColor={colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Nombre Empresa */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre de la Empresa</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Ferretería El Sol S.A.S."
                  placeholderTextColor={colors.textMuted}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
            </View>

            {/* Teléfono de Contacto */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Teléfono de Contacto</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: +57 310 123 4567"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* Dirección */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Dirección Destino <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={18} color={colors.accent} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Carrera 15 # 85-30"
                  placeholderTextColor={colors.textMuted}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
              <Text style={styles.fieldHint}>
                Esta es la dirección a la cual Google Maps calculará la ruta.
              </Text>
            </View>

            {/* Ciudad */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Ciudad / Municipio</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="map-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Bogotá, Medellín, Cali..."
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>

            {/* Notas / Indicaciones */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Indicaciones de Llegada / Notas</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: Timbre 301, portón gris, preguntar por el encargado de almacén."
                  placeholderTextColor={colors.textMuted}
                  multiline={true}
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>
          </ScrollView>

          {/* Botones de acción */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color={colors.white} />
              <Text style={styles.saveBtnText}>
                {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  form: {
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  required: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
  },
  textAreaContainer: {
    height: 80,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    textAlignVertical: 'top',
    height: '100%',
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
