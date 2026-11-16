import React from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'name', label: 'Nombre' },
  { id: 'company', label: 'Empresa' },
  { id: 'address', label: 'Dirección' },
  { id: 'phone', label: 'Teléfono' },
];

export default function SearchBar({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  totalResults,
}) {
  return (
    <View style={styles.container}>
      {/* Barra de Búsqueda Principal */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Buscar cliente, empresa, dirección..."
          placeholderTextColor={colors.textMuted}
          value={searchTerm}
          onChangeText={onSearchChange}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips de filtro por campo */}
      <View style={styles.chipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => onCategoryChange(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Contador de resultados */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {totalResults === 1 ? '1 cliente encontrado' : `${totalResults} clientes encontrados`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  chipsWrapper: {
    marginTop: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  counterRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
