import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  tenants?: any[];
  openAddTenant?: any;
  tenantQ?: any;
  setTenantQ?: any;
  tenantFilter?: any;
  setTenantFilter?: any;
  activeTenants?: any[];
  inactiveTenants?: any[];
  filteredTenants?: any[];
  statusLoading?: any;
  downloadAgreement?: any;
  handlePreview?: any;
  toggleTenantStatus?: any;
  styles?: any;
};

export default function OwnerTenants(props: Props) {
  const {
    tenants = [],
    openAddTenant,
    tenantQ,
    setTenantQ,
    tenantFilter = 'all',
    setTenantFilter,
    activeTenants = [],
    inactiveTenants = [],
    filteredTenants = [],
    statusLoading = {},
    downloadAgreement,
    handlePreview,
    toggleTenantStatus,
    styles = {},
  } = props;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        {/* Empty state */}
        {tenants.length === 0 && (
          <View
            style={{
              padding: 18,
              backgroundColor: '#fff',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
              No tenants found
            </Text>
            <Text style={{ color: '#666', marginBottom: 12 }}>
              You haven't added any tenants yet.
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#666' }}>{tenants.length} tenants</Text>
          <TouchableOpacity
            style={[styles?.smallBtn, { paddingHorizontal: 12 }]}
            onPress={() => openAddTenant && openAddTenant()}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add Tenant</Text>
          </TouchableOpacity>
        </View>

        <View style={styles?.filterRow || {}}>
          <View style={styles?.searchBox || {}}>
            <Ionicons name="search" size={16} color="#666" />
            <TextInput
              placeholder="Search"
              value={tenantQ}
              onChangeText={setTenantQ}
              style={{ marginLeft: 8, flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', marginLeft: 8 }}>
            <TouchableOpacity
              style={[styles?.filterBtn, tenantFilter === 'all' && styles?.filterActive]}
              onPress={() => setTenantFilter && setTenantFilter('all')}
            >
              <Text>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles?.filterBtn, tenantFilter === 'active' && styles?.filterActive]}
              onPress={() => setTenantFilter && setTenantFilter('active')}
            >
              <Text>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles?.filterBtn, tenantFilter === 'inactive' && styles?.filterActive]}
              onPress={() => setTenantFilter && setTenantFilter('inactive')}
            >
              <Text>Inactive</Text>
            </TouchableOpacity>
          </View>
        </View>

        {tenantFilter === 'all' ? (
          <>
            <Text style={[styles?.sectionTitle || {}, { marginTop: 6 }]}>Active Tenants</Text>
            {activeTenants.length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#666' }}>No active tenants.</Text>
              </View>
            ) : (
              <FlatList
                data={activeTenants}
                keyExtractor={(i: any) => i.id}
                contentContainerStyle={{ paddingBottom: 120 }}
                renderItem={({ item }) => (
                  <View style={styles?.tenantCard || {}}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles?.tenantName}>{item.name}</Text>
                      <Text style={styles?.tenantMeta}>
                        {item.role || 'Tenant'} • {item.phone}
                      </Text>
                      {item.flat ? (
                        <Text style={styles?.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                      ) : null}
                      <Text style={styles?.tenantDates}>
                        Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                        {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View
                        style={[
                          styles?.badge || {},
                          item.status === 'active' ? styles?.badgeActive : styles?.badgeInactive,
                        ]}
                      >
                        <Text style={{ color: '#fff' }}>
                          {item.status === 'active' ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          style={{ marginTop: 8, marginRight: 8 }}
                          onPress={() => openAddTenant && openAddTenant(item)}
                        >
                          <Ionicons name="eye" size={18} />
                        </TouchableOpacity>
                        {item.history?.agreements && item.history.agreements.length > 0 ? (
                          <TouchableOpacity
                            style={{ marginTop: 8, marginRight: 8 }}
                            onPress={() => {
                              try {
                                const agr = item.history.agreements[0];
                                const url =
                                  agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                                if (url && downloadAgreement) downloadAgreement(url);
                              } catch (e) {}
                            }}
                          >
                            <Ionicons name="document-text" size={18} color="#374151" />
                          </TouchableOpacity>
                        ) : null}
                        {item.history?.documents && item.history.documents.length > 0 ? (
                          <TouchableOpacity
                            style={{ marginTop: 8, marginRight: 8 }}
                            onPress={() => {
                              try {
                                const doc = item.history.documents[0];
                                const url =
                                  doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                                if (url && handlePreview) handlePreview(url);
                              } catch (e) {}
                            }}
                          >
                            <Ionicons name="document-attach" size={18} color="#374151" />
                          </TouchableOpacity>
                        ) : null}
                        {statusLoading[item.id] ? (
                          <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles?.smallBtn || {},
                              { backgroundColor: '#e74c3c', marginTop: 8 },
                            ]}
                            onPress={() =>
                              toggleTenantStatus && toggleTenantStatus(item, 'inactive')
                            }
                          >
                            <Text style={{ color: '#fff' }}>Deactivate</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}

            <Text style={[styles?.sectionTitle || {}, { marginTop: 12 }]}>Inactive Tenants</Text>
            {inactiveTenants.length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#666' }}>No inactive tenants.</Text>
              </View>
            ) : (
              <FlatList
                data={inactiveTenants}
                keyExtractor={(i: any) => i.id}
                contentContainerStyle={{ paddingBottom: 120 }}
                renderItem={({ item }) => (
                  <View style={styles?.tenantCard || {}}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles?.tenantName}>{item.name}</Text>
                      <Text style={styles?.tenantMeta}>
                        {item.role || 'Tenant'} • {item.phone}
                      </Text>
                      {item.flat ? (
                        <Text style={styles?.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                      ) : null}
                      <Text style={styles?.tenantDates}>
                        Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                        {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View
                        style={[
                          styles?.badge || {},
                          item.status === 'active' ? styles?.badgeActive : styles?.badgeInactive,
                        ]}
                      >
                        <Text style={{ color: '#fff' }}>
                          {item.status === 'active' ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          style={{ marginTop: 8, marginRight: 8 }}
                          onPress={() => openAddTenant && openAddTenant(item)}
                        >
                          <Ionicons name="eye" size={18} />
                        </TouchableOpacity>
                        {item.history?.agreements && item.history.agreements.length > 0 ? (
                          <TouchableOpacity
                            style={{ marginTop: 8, marginRight: 8 }}
                            onPress={() => {
                              try {
                                const agr = item.history.agreements[0];
                                const url =
                                  agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                                if (url && downloadAgreement) downloadAgreement(url);
                              } catch (e) {}
                            }}
                          >
                            <Ionicons name="document-text" size={18} color="#374151" />
                          </TouchableOpacity>
                        ) : null}
                        {item.history?.documents && item.history.documents.length > 0 ? (
                          <TouchableOpacity
                            style={{ marginTop: 8, marginRight: 8 }}
                            onPress={() => {
                              try {
                                const doc = item.history.documents[0];
                                const url =
                                  doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                                if (url && handlePreview) handlePreview(url);
                              } catch (e) {}
                            }}
                          >
                            <Ionicons name="document-attach" size={18} color="#374151" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        ) : (
          <FlatList
            data={filteredTenants}
            keyExtractor={(i: any) => i.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={styles?.tenantCard || {}}>
                <View style={{ flex: 1 }}>
                  <Text style={styles?.tenantName}>{item.name}</Text>
                  <Text style={styles?.tenantMeta}>
                    {item.role || 'Tenant'} • {item.phone}
                  </Text>
                  {item.flat ? (
                    <Text style={styles?.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                  ) : null}
                  <Text style={styles?.tenantDates}>
                    Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                    {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles?.badge || {},
                      item.status === 'active' ? styles?.badgeActive : styles?.badgeInactive,
                    ]}
                  >
                    <Text style={{ color: '#fff' }}>
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={{ marginTop: 8, marginRight: 8 }}
                      onPress={() => openAddTenant && openAddTenant(item)}
                    >
                      <Ionicons name="eye" size={18} />
                    </TouchableOpacity>
                    {item.history?.agreements && item.history.agreements.length > 0 ? (
                      <TouchableOpacity
                        style={{ marginTop: 8, marginRight: 8 }}
                        onPress={() => {
                          try {
                            const agr = item.history.agreements[0];
                            const url = agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                            if (url && downloadAgreement) downloadAgreement(url);
                          } catch (e) {}
                        }}
                      >
                        <Ionicons name="document-text" size={18} color="#374151" />
                      </TouchableOpacity>
                    ) : null}
                    {item.history?.documents && item.history.documents.length > 0 ? (
                      <TouchableOpacity
                        style={{ marginTop: 8, marginRight: 8 }}
                        onPress={() => {
                          try {
                            const doc = item.history.documents[0];
                            const url = doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                            if (url && handlePreview) handlePreview(url);
                          } catch (e) {}
                        }}
                      >
                        <Ionicons name="document-attach" size={18} color="#374151" />
                      </TouchableOpacity>
                    ) : null}
                    {statusLoading[item.id] ? (
                      <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
                    ) : item.status === 'active' ? (
                      <TouchableOpacity
                        style={[
                          styles?.smallBtn || {},
                          { backgroundColor: '#e74c3c', marginTop: 8 },
                        ]}
                        onPress={() => toggleTenantStatus && toggleTenantStatus(item, 'inactive')}
                      >
                        <Text style={{ color: '#fff' }}>Deactivate</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
