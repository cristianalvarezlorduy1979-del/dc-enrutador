import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { openRouteInGoogleMaps, makePhoneCall, openWhatsApp } from '../services/mapsService';

export default function ClientCard({ client, onEdit, onDelete, onToggleFavorite }) {
  const handleConfirmDelete = () => {
    Alert.alert(
      'Eliminar cliente',
      `¿Estás seguro de que deseas eliminar a ${client.fullName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(client.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      {/* Cabecera de la Tarjeta */}
      <View style={styles.headerRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {client.fullName}
          </Text>
          {client.companyName ? (
            <View style={styles.companyBadge}>
              <Ionicons name="business" size={13} color={colors.primary} />
              <Text style={styles.companyText} numberOfLines={1}>
                {client.companyName}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => onToggleFavorite(client.id, client.isFavorite)}
          style={styles.favoriteButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={client.isFavorite ? 'star' : 'star-outline'}
            size={22}
            color={client.isFavorite ? colors.warning : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Datos del Cliente */}
      <View style={styles.infoSection}>
        {/* Dirección Destino */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainerMap}>
            <Ionicons name="location" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Dirección de entrega / visita</Text>
            <Text style={styles.addressText}>
              {client.address}
              {client.city ? `, ${client.city}` : ''}
            </Text>
          </View>
        </View>

        {/* Teléfono */}
        {client.phone ? (
          <View style={styles.infoRow}>
            <View style={styles.iconContainerPhone}>
              <Ionicons name="call" size={16} color={colors.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Teléfono de contacto</Text>
              <Text style={styles.phoneText}>{client.phone}</Text>
            </View>
          </View>
        ) : null}

        {/* Notas adicionales si existen */}
        {client.notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.notesText}>{client.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* BOTÓN PRINCIPAL: Abrir Ruta en Google Maps */}
      <TouchableOpacity
        style={styles.routeButton}
        onPress={() => openRouteInGoogleMaps(client.address, client.city)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="google-maps" size={22} color={colors.white} />
        <Text style={styles.routeButtonText}>Ruta en Google Maps</Text>
        <Ionicons name="navigate" size={18} color={colors.white} style={styles.navigateIcon} />
      </TouchableOpacity>

      {/* Acciones Secundarias de Contacto y Gestión */}
      <View style={styles.actionsRow}>
        {client.phone ? (
          <>
            <TouchableOpacity
              style={[styles.smallActionBtn, styles.callBtn]}
              onPress={() => makePhoneCall(client.phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={15} color={colors.primaryDark} />
              <Text style={styles.callBtnText}>Llamar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallActionBtn, styles.waBtn]}
              onPress={() => openWhatsApp(client.phone, client.fullName)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={16} color={colors.whatsapp} />
              <Text style={styles.waBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.iconActionBtn, styles.editBtn]}
          onPress={() => onEdit(client)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconActionBtn, styles.deleteBtn]}
          onPress={handleConfirmDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  companyText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  favoriteButton: {
    padding: 4,
  },
  infoSection: {
    gap: 8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainerMap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FDE8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerPhone: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  addressText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: 1,
  },
  phoneText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    marginTop: 1,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 4,
  },
  notesText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  routeButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  navigateIcon: {
    marginLeft: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
    paddingTop: 10,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtn: {
    backgroundColor: colors.primaryLight,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  waBtn: {
    backgroundColor: '#DCF8C6',
  },
  waBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#075E54',
  },
  spacer: {
    flex: 1,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
  },
  editBtn: {},
  deleteBtn: {
    backgroundColor: '#FDE8E8',
  },
});
