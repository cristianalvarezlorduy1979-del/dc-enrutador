import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './src/theme/colors';
import {
  initDatabase,
  getClients,
  addClient,
  updateClient,
  deleteClient,
  toggleFavorite,
  SAMPLE_CLIENTS,
} from './src/database/db';
import SearchBar from './src/components/SearchBar';
import ClientCard from './src/components/ClientCard';
import ClientModal from './src/components/ClientModal';
import EmptyState from './src/components/EmptyState';

export default function App() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado del modal de creación/edición
  const [modalVisible, setModalVisible] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);

  // Inicialización de la base de datos
  const loadData = useCallback(async (search = searchTerm, category = selectedCategory) => {
    try {
      const data = await getClients(search, category);
      setClients(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes de la base de datos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await loadData();
      } catch (err) {
        console.error('Error en inicialización:', err);
        setLoading(false);
      }
    })();
  }, [loadData]);

  // Manejo de búsqueda en tiempo real
  const handleSearchChange = (text) => {
    setSearchTerm(text);
    loadData(text, selectedCategory);
  };

  // Manejo de cambio de filtro por categoría
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    loadData(searchTerm, category);
  };

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setClientToEdit(null);
    setModalVisible(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (client) => {
    setClientToEdit(client);
    setModalVisible(true);
  };

  // Guardar cliente (crear o editar)
  const handleSaveClient = async (formData) => {
    try {
      if (clientToEdit) {
        await updateClient(clientToEdit.id, formData);
      } else {
        await addClient(formData);
      }
      setModalVisible(false);
      setClientToEdit(null);
      await loadData();
    } catch (error) {
      Alert.alert('Error al guardar', error.message || 'No se pudo guardar la información del cliente.');
    }
  };

  // Eliminar cliente
  const handleDeleteClient = async (id) => {
    try {
      await deleteClient(id);
      await loadData();
    } catch (error) {
      Alert.alert('Error al eliminar', error.message || 'No se pudo eliminar el cliente.');
    }
  };

  // Alternar favorito
  const handleToggleFavorite = async (id, currentVal) => {
    try {
      await toggleFavorite(id, currentVal);
      await loadData();
    } catch (error) {
      console.error('Error al alternar favorito:', error);
    }
  };

  // Cargar clientes de demostración
  const handleLoadSamples = async () => {
    try {
      setLoading(true);
      for (const sample of SAMPLE_CLIENTS) {
        await addClient(sample);
      }
      await loadData();
      Alert.alert('Éxito', 'Se cargaron los clientes de demostración.');
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los ejemplos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

        {/* Encabezado Principal */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="map" size={20} color={colors.white} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Enrutador</Text>
              <Text style={styles.headerSubtitle}>Base de Clientes & Rutas</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.newClientButton}
            onPress={handleOpenCreateModal}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.newClientButtonText}>Nuevo</Text>
          </TouchableOpacity>
        </View>

        {/* Buscador y Filtros */}
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          totalResults={clients.length}
        />

        {/* Contenido Principal / Lista de Clientes */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando base de datos...</Text>
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <ClientCard
                client={item}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteClient}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                isSearching={searchTerm.trim().length > 0}
                searchTerm={searchTerm}
                onClearSearch={() => handleSearchChange('')}
                onAddClient={handleOpenCreateModal}
                onLoadSamples={clients.length === 0 && !searchTerm ? handleLoadSamples : null}
              />
            }
          />
        )}

        {/* Modal de Crear / Editar Cliente */}
        <ClientModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setClientToEdit(null);
          }}
          onSave={handleSaveClient}
          clientToEdit={clientToEdit}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  newClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  newClientButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  listContainer: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
