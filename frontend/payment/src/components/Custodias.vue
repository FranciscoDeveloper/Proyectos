<template>
  <v-container>
    <v-card class="pa-4" elevation="3">
      <v-card-title class="text-h6 text-primary">Inventario de Bodega</v-card-title>
      <v-data-table
        :items="items"
        class="elevation-1 rounded-lg"
        density="comfortable"
        hover
        fixed-header
      >
        <template #item.ost="{ item }">

          <!-- Si OST es una lista -->
          <v-chip-group column>
            <v-chip
              v-for="ost in item.ost"
              :key="ost"
              color="blue-lighten-3"
              text-color="blue-darken-4"
              class="ma-1"
              small
            >
              {{ ost }}
            </v-chip>
          </v-chip-group>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup>
const headers = [
  { text: 'Bodega', value: 'bodega' },
  { text: 'Marca del artículo', value: 'marca' },
  { text: 'Código del artículo', value: 'codigo' },
  { text: 'Descripción del artículo', value: 'descripcion' },
  { text: 'Cantidad', value: 'cantidad' },
  { text: 'Para qué órdenes de servicio técnico fueron entregados', value: 'ost' },
];

const items = [
  {
    bodega: 'Central',
    marca: 'Samsung',
    codigo: 'SMG12345',
    descripcion: 'Pantalla LED 32"',
    cantidad: 12,
    ost: ['OST-001', 'OST-005'],
  },
  {
    bodega: 'Técnico A',
    marca: 'LG',
    codigo: 'LG67890',
    descripcion: 'Placa base XZ-900',
    cantidad: 4,
    ost: ['OST-003'],
  },
  {
    bodega: 'Técnico B',
    marca: 'Sony',
    codigo: 'SON123',
    descripcion: 'Control remoto universal',
    cantidad: 20,
    ost: [],
  },
];
</script>

<style scoped>
.v-data-table {
  border-radius: 12px;
  overflow: hidden;
}
</style>
