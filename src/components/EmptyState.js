import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function EmptyState({ isSearching, searchTerm, onClearSearch, onAddClient, onLoadSamples }) {
  if (isSearching) {
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
        </View>
        <Text style={styles.title}>Sin resultados</Text>
        <Text style={styles.description}>
          No se encontraron clientes que coincidan con &ldquo;{searchTerm}&rdquo;.
        </Text>
        <TouchableOpacity style={styles.actionButton} onPress={onClearSearch} activeOpacity={0.8}>
          <Ionicons name="close-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.actionButtonText}>Limpiar filtro de búsqueda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, styles.emptyCircle]}>
        <Ionicons name="navigate-circle-outline" size={54} color={colors.primary} />
      </View>
      <Text style={styles.title}>Comienza a organizar tus rutas</Text>
      <Text style={styles.description}>
        Registra a tus clientes con su dirección para poder buscar y trazar rutas directas a Google Maps en un solo toque.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onAddClient} activeOpacity={0.85}>
        <Ionicons name="person-add" size={18} color={colors.white} />
        <Text style={styles.primaryButtonText}>Agregar primer cliente</Text>
      </TouchableOpacity>

      {onLoadSamples ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onLoadSamples} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={16} color={colors.textSecondary} />
          <Text style={styles.secondaryButtonText}>Cargar clientes de demostración</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
