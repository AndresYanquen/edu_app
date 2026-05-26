<template>
  <Transition name="payment-banner-fade" mode="out-in">
    <section :key="status" class="payment-banner" :class="`is-${status}`" aria-live="polite">
      <div class="payment-banner__left">
        <div class="payment-banner__icon-wrap">
          <i :class="bannerIcon" />
        </div>
        <div class="payment-banner__copy">
          <div class="payment-banner__headline-row">
            <h4>{{ headline }}</h4>
            <span v-if="status === 'late'" class="payment-banner__badge">En mora</span>
          </div>
          <p>{{ subtitle }}</p>
          <div class="payment-banner__meta">
            <span v-if="status === 'upcoming'">Fecha límite: <strong>{{ dueDateLabel }}</strong></span>
            <span v-if="status === 'upcoming'">Valor: <strong>{{ amountLabel }}</strong></span>
            <span v-if="status === 'late'">Días de atraso: <strong>{{ overdueDays }}</strong></span>
            <span v-if="status === 'late'">Valor pendiente: <strong>{{ amountLabel }}</strong></span>
            <span v-if="status === 'paid'">Próximo cobro: <strong>{{ dueDateLabel }}</strong></span>
          </div>
        </div>
      </div>

      <div class="payment-banner__actions">
        <Button
          :label="primaryLabel"
          class="payment-banner__primary"
          size="small"
          :disabled="isLoading"
          @click="$emit('primary-click')"
        />
        <button
          type="button"
          class="payment-banner__link"
          :disabled="isLoading"
          @click="$emit('secondary-click')"
        >
          {{ secondaryLabel }}
        </button>
      </div>
    </section>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';

const props = defineProps({
  status: {
    type: String,
    default: 'upcoming',
    validator: (value) => ['upcoming', 'late', 'paid', 'loading'].includes(value),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  amount: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'MXN',
  },
  dueDate: {
    type: String,
    default: '',
  },
  overdueDays: {
    type: Number,
    default: 0,
  },
});

defineEmits(['primary-click', 'secondary-click']);

const isLoading = computed(() => props.loading || props.status === 'loading');

const amountLabel = computed(() =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: props.currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(props.amount || 0)),
);

const dueDateLabel = computed(() => {
  if (!props.dueDate) return 'Por definir';
  const date = new Date(props.dueDate);
  if (Number.isNaN(date.getTime())) return 'Por definir';
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
});

const headline = computed(() => {
  if (isLoading.value) return 'Consultando tus pagos';
  if (props.status === 'late') return 'Tu suscripción presenta pagos vencidos';
  if (props.status === 'paid') return 'Estás al día con tus pagos';
  return 'Pago pendiente';
});

const subtitle = computed(() => {
  if (isLoading.value) return 'Estamos revisando el estado de tu cuenta.';
  if (props.status === 'late') return 'Evita la suspensión de tus cursos realizando el pago.';
  if (props.status === 'paid') return 'Continúa aprendiendo sin interrupciones 🚀';
  return `Tienes ${Math.max(Number(props.overdueDays || 0), 0)} días para realizar tu próximo pago.`;
});

const bannerIcon = computed(() => {
  if (isLoading.value) return 'pi pi-spin pi-spinner';
  if (props.status === 'late') return 'pi pi-exclamation-triangle';
  if (props.status === 'paid') return 'pi pi-check-circle';
  return 'pi pi-calendar';
});

const primaryLabel = computed(() => {
  if (isLoading.value) return 'Cargando';
  if (props.status === 'late') return 'Pagar ahora';
  if (props.status === 'paid') return 'Ver historial';
  return 'Realizar pago';
});

const secondaryLabel = computed(() => {
  if (props.status === 'late') return 'Ver detalles de pago';
  if (props.status === 'paid') return 'Ver detalles de pago';
  return 'Ver detalles de pago';
});
</script>

<style scoped>
.payment-banner {
  width: 100%;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.payment-banner.is-upcoming {
  background: linear-gradient(135deg, #fff7ed, #fffbeb);
  border-color: #fed7aa;
}

.payment-banner.is-late {
  background: linear-gradient(135deg, #fef2f2, #fff1f2);
  border-color: #fecaca;
}

.payment-banner.is-paid {
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  border-color: #bbf7d0;
}

.payment-banner.is-loading {
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  border-color: #bfdbfe;
}

.payment-banner__left {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.payment-banner__icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(15, 23, 42, 0.08);
  flex-shrink: 0;
}

.payment-banner__icon-wrap i {
  font-size: 1rem;
}

.payment-banner__copy h4 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.2;
  color: #0f172a;
}

.payment-banner__copy p {
  margin: 0.2rem 0 0;
  font-size: 0.88rem;
  color: #475569;
}

.payment-banner__headline-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.payment-banner__badge {
  padding: 0.18rem 0.52rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
}

.payment-banner__meta {
  margin-top: 0.32rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: #64748b;
}

.payment-banner__meta strong {
  color: #1e293b;
}

.payment-banner__actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
}

.payment-banner__primary {
  border-radius: 10px;
}

.payment-banner__link {
  border: 0;
  background: transparent;
  color: #1d4ed8;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.payment-banner__link:hover {
  text-decoration: underline;
}

.payment-banner__link:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  text-decoration: none;
}

.payment-banner-fade-enter-active,
.payment-banner-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.payment-banner-fade-enter-from,
.payment-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 900px) {
  .payment-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .payment-banner__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
