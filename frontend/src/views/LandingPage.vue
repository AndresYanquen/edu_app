<template>
  <div class="landing-page">
    <section class="hero">
      <nav class="hero__nav">
        <section class="brand">
          <img class="brand__mascot" src="/assets/images/pollito.png" alt="Mascota de PrimeLMS" />
          <div class="logo">PrimeLMS</div>
        </section>
        <div class="hero__nav-links">
          <a href="#">Plataforma</a>
          <a href="#">Soluciones</a>
          <a href="#">Precios</a>
          <a href="#">Blog</a>
        </div>
        <div class="hero__nav-actions">
          <a class="hero__login" href="/login">{{ loginLabel }}</a>
          <button class="btn btn--primary">Sign Up</button>
        </div>
      </nav>
      <div class="hero__content">
        <div class="hero__copy">
          <div class="hero__eyebrow-row">
            <p class="hero__eyebrow">LMS SaaS para equipos que escalan</p>
            <span class="hero__badge">Hecho en Colombia 🇨🇴</span>
          </div>
          <h1>
            Plataforma de aprendizaje online
            <span>academias</span>
          </h1>
          <p class="hero__lead">
            Diseña rutas de onboarding, evalúa conocimientos y automatiza reportes
            desde un solo panel. Integra clases en vivo, contenido asincrónico
            y analíticas predictivas en minutos.
          </p>
          <div class="hero__actions">
            <button class="btn btn--primary">Comenzar gratis</button>
            <button class="btn btn--ghost">Ver recorrido</button>
          </div>
          <small> Nuestra meta</small>
          <div class="hero__stats">
            <article class="stat-card">
              <strong>2,500+</strong>
              <span>organizaciones</span>
            </article>
            <article class="stat-card">
              <strong>98%</strong>
              <span>retención de estudiantes</span>
            </article>
            <article class="stat-card">
              <strong>24/7</strong>
              <span>soporte experto</span>
            </article>
          </div>
        </div>
        <div class="hero__visual">
          <div class="hero__visual-panel">
            <div class="hero__visual-header">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <div class="hero__visual-cards">
              <img class="book" src="/assets/3dIcons/book.png" alt="Libro digital" />
              <img class="rocket" src="/assets/3dIcons/rocket.png" alt="Cohete representando crecimiento" />
              <div class="widget widget--progress">
                <p>Progreso de cohortes</p>
                <small>Aprendizaje al mismo ritmo</small>
              </div>
              <div class="widget widget--certs">
                <p>Certificados</p>
                <ul>
                  <li><span class="dot-pill"></span>Aprendizaje ágil</li>
                  <li><span class="dot-pill"></span>Gestión avanzada</li>
                  <li><span class="dot-pill"></span>Labs supervisados</li>
                </ul>
              </div>
              <div class="widget widget--cohorts">
                <p>Clases en vivo</p>
                <div class="cohort-row">
                  <span class="cohort-dot"></span>
                  <span>Programa sesiones en vivo para tus estudiantes</span>
                </div>
              </div>
            </div>
            <div class="hero__visual-footer">
              <p>Panel de instrucción activa</p>
              <span>Seguimiento de progreso, quiz y reportes</span>
            </div>
          </div>
          <div class="hero__visual-blob" aria-hidden="true"></div>
        </div>
      </div>
    </section>

    <section class="offers">
      <article v-for="item in offers" :key="item.title">
        <div class="icon">
          <i :class="item.icon" aria-hidden="true"></i>
        </div>
        <div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </div>
      </article>
    </section>

    <section class="insights">
      <div class="insights__text">
        <p class="eyebrow">Todo en uno</p>
        <h2>Contenido, evaluaciones y analíticas pensadas para equipos SaaS</h2>
        <p>
          Automatiza certificaciones, controla accesos por rol y programa mentorías
          sin fragmentar tus herramientas.
        </p>
        <div class="insights__list">
          <div v-for="point in insights" :key="point.title">
            <strong>{{ point.title }}</strong>
            <p>{{ point.description }}</p>
          </div>
        </div>
      </div>
      <div class="insights__visual">
        <div class="insights__card">
          <h4>Monitor de rutas</h4>
          <p>Camina a tus aprendices desde el onboarding hasta las metas de growth.</p>
        </div>
        <div class="insights__card insights__card--accent">
          <h4>Microlearning</h4>
          <p>Libera microcontenidos en video y texto con actualizaciones instantáneas.</p>
        </div>
      </div>
    </section>

    <section class="feature-stack">
      <article
        v-for="(block, idx) in storyBlocks"
        :key="block.title"
        :class="['feature-stack__item', { 'is-reversed': idx % 2 === 1 }]"
        :data-accent="block.tag"
      >
        <div class="feature-stack__meta">
          <span class="feature-stack__eyebrow-pill">{{ block.tag }}</span>
          <h3>{{ block.title }}</h3>
          <p>{{ block.description }}</p>
        </div>
        <div class="feature-stack__visual">
          <img :src="block.image" :alt="block.title" loading="lazy" />
        </div>
      </article>
    </section>

    <!-- <section class="trust">
      <p class="eyebrow">Compañías que confían</p>
      <div class="trust__logos">
        <span v-for="logo in logos" :key="logo">{{ logo }}</span>
      </div>
    </section> -->

    <section class="cta-footer">
      <div class="cta-card">
        <h3>Crea tu academia SaaS sin esfuerzo</h3>
        <p>
          Eleva tu academia al siguiente nivel con la ayuda de PrimeLMS. Déjanos ayudarte:
        </p>
        <form class="cta-form">
          <label class="sr-only" for="landing-email">Correo electrónico</label>
          <input id="landing-email" type="email" placeholder="Tu correo" />
          <button type="submit" class="btn btn--primary">Solicitar demo</button>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const loginLabel = computed(() => (auth.isAuthenticated ? 'Entrar' : 'Login'));

const offers = [
  {
    title: 'Rutas guiadas',
    description: 'Crea playlists dinámicos y calendarios inteligentes por rol.',
    icon: 'pi pi-face-smile',
  },
  {
    title: 'Evaluaciones activas',
    description: 'Pruebas de progreso, encuestas y feedback en tiempo real.',
    icon: 'pi pi-chart-line',
  },
  {
    title: 'Integraciones clave',
    description: 'Conecta con Slack, CRM, HRIS y tus herramientas favoritas.',
    icon: 'pi pi-share-alt',
  },
  {
    title: 'Analíticas predictivas',
    description: 'Detecta abandono temprano y mide impacto de cada cohorte.',
    icon: 'pi pi-bolt',
  },
];

const insights = [
  {
    title: 'Automatiza certificaciones',
    description: 'Programación de rutas, recordatorios y firmas automáticas.',
  },
  {
    title: 'Escala contenido',
    description: 'Biblioteca modular con traducciones, subtítulos y accesibilidad.',
  },
  {
    title: 'Soporte en vivo',
    description: 'Equipos dedicados y playbooks de lanzamiento.',
  },
];

const storyBlocks = [
  {
    tag: 'Productividad',
    title: 'Panel de cohortes en un vistazo',
    description: 'Segmenta grupos, asigna mentores y observa métricas de engagement al instante.',
    image: '/assets/3dIcons/tools.jpg',
  },
  {
    tag: 'Adopción',
    title: 'Centro de recursos inmersivos',
    description: 'Publica cursos con microvideos, docs interactivos y rutas certificadas.',
    image: '/assets/3dIcons/inmmerse.jpg',
  },
  {
    tag: 'Escalabilidad',
    title: 'Automatiza tus lanzamientos',
    description: 'Plantillas, campañas de email y videos pregrabados listos para usar.',
    image: '/assets/3dIcons/allyouneed.jpg',
  },
];

const logos = ['Beneoshop', 'Caspio', 'Hyperion', 'LEO TRIPPI', 'Cumbre LMS'];
</script>

<style scoped>
@import '../styles/tokens.css';

.landing-page {
  background: var(--app-bg);
  color: var(--text-primary);
  font-family: var(--font-body);
}

h1,
h2,
h3,
.logo {
  font-family: var(--font-heading);
}

.hero {
  padding: clamp(1.5rem, 3vw, 2.75rem);
  min-height: 90vh;
  background:
    radial-gradient(circle at 15% 25%, rgba(34, 197, 94, 0.14), transparent 45%),
    radial-gradient(circle at 85% 70%, rgba(56, 189, 248, 0.12), transparent 42%),
    linear-gradient(180deg, #fbfdff 0%, #f6fbf8 100%);
  border-bottom: 1px solid rgba(13, 59, 102, 0.08);
}

.hero__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand__mascot {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

@keyframes breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1px) scale(1.03);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .brand__mascot {
    animation: breathe 3.6s ease-in-out infinite;
    transform-origin: center;
  }
}

.hero__nav-links {
  display: flex;
  gap: 1.5rem;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.hero__nav-links a {
  position: relative;
  color: inherit;
  text-decoration: none;
  padding-bottom: 0.25rem;
}

.hero__nav-links a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: var(--brand-primary);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.2s ease;
}

.hero__nav-links a:hover::after,
.hero__nav-links a:focus-visible::after {
  transform: scaleX(1);
}

.hero__nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hero__login {
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: #fff;
  font-weight: 600;
  color: var(--text-primary);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.hero__login:hover,
.hero__login:focus-visible {
  background: #f4f5f7;
  border-color: rgba(13, 59, 102, 0.35);
}

.hero__content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  align-items: center;
  margin-top: 2rem;
}

.hero__copy h1 {
  font-size: clamp(2.2rem, 4vw, 3.6rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  max-width: 22ch;
  margin: 0.4rem 0 1rem;
}

.hero__copy h1 span {
  color: var(--brand-primary);
  display: block;
}

.hero__lead {
  color: var(--text-secondary);
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 60ch;
}

.hero__actions {
  display: flex;
  gap: 0.75rem;
  margin: 2rem 0 1rem;
  flex-wrap: wrap;
}

.btn {
  border-radius: 999px;
  padding: 0.85rem 1.75rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}

.btn:focus-visible {
  outline: 3px solid rgba(34, 197, 94, 0.35);
  outline-offset: 3px;
}

.btn--primary {
  background: var(--brand-primary);
  color: #fff;
  box-shadow: 0 12px 28px rgba(13, 59, 102, 0.18);
}

.btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(13, 59, 102, 0.25);
}

.btn--primary:active {
  transform: translateY(0);
}

.btn--ghost {
  background: transparent;
  border: 1px solid rgba(13, 59, 102, 0.25);
  color: var(--text-primary);
}

.btn--ghost:hover {
  background: rgba(13, 59, 102, 0.08);
  border-color: rgba(13, 59, 102, 0.4);
}

.hero__stats {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.8rem;
}

.stat-card {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  box-shadow: var(--shadow-sm);
}

.stat-card strong {
  display: block;
  font-size: 1.35rem;
  line-height: 1.2;
}

.stat-card span {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.hero__visual {
  position: relative;
  justify-self: center;
}

.hero__visual-panel {
  min-height: 360px;
  width: min(380px, 85vw);
  padding: 1.75rem;
  border-radius: 26px;
  border: 1px solid var(--app-border);
  background: #fff;
  box-shadow: var(--shadow-md);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.hero__visual-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 46px rgba(15, 23, 42, 0.25);
}

.hero__visual-header {
  display: flex;
  gap: 0.45rem;
  margin-bottom: 1.25rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--brand-primary-soft);
}

.hero__visual-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.9rem;
  position: relative;
}

.hero__visual-cards img {
  position: absolute;
  z-index: 10;
}

.hero__visual-cards .book {
    width: 108px;
    right: 56px;
    bottom: 0px;
}

.hero__visual-cards .rocket {
    width: 80px;
    bottom: 39px;
    right: 0px;
}

.widget {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 18px;
  padding: 0.9rem 1rem;
  box-shadow: var(--shadow-sm);
}

.widget p {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.widget small,
.widget ul {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: #eef4ff;
  border-radius: 999px;
  margin-top: 0.55rem;
  overflow: hidden;
}

.progress-track span {
  display: block;
  height: 100%;
  background: var(--brand-primary);
  border-radius: 999px;
}

.widget--certs ul {
  list-style: none;
  padding: 0;
}

.widget--certs li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.1rem 0;
}

.dot-pill {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand-primary);
}

.widget--cohorts .cohort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 0;
  font-size: 0.85rem;
}

.cohort-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand-primary-soft);
}

.cohort-pill {
  background: rgba(13, 59, 102, 0.08);
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.hero__visual-footer {
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.hero__visual-blob {
  position: absolute;
  right: -12px;
  bottom: -14px;
  width: 130px;
  height: 130px;
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.35), rgba(37, 99, 235, 0.15));
  border-radius: 999px;
  opacity: 0.35;
  z-index: -1;
}

.hero__eyebrow-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.hero__badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  background: rgba(13, 59, 102, 0.08);
  border-radius: 999px;
  color: var(--text-primary);
}

.offers,
.insights,
.feature-stack,
.trust,
.cta-footer {
  padding: 3rem clamp(1.5rem, 4vw, 3rem);
}

.offers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.offers article {
  background: #fff;
  padding: 1.5rem;
  border-radius: 20px;
  border: 1px solid var(--app-border);
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.offers article:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.15);
}

.offers .icon {
  min-width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0d3b66, #38bdf8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.2rem;
}

.offers h3 {
  margin: 0;
}

.offers p {
  margin-top: 0.25rem;
  color: var(--text-secondary);
}

.insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  align-items: center;
}

.insights__text h2 {
  margin: 0.5rem 0;
  font-size: clamp(1.9rem, 3vw, 2.5rem);
}

.insights__list {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

.insights__list strong {
  color: var(--text-primary);
}

.insights__list p {
  margin: 0;
  color: var(--text-secondary);
}

.insights__visual {
  display: grid;
  gap: 1rem;
}

.insights__card {
  background: #fff;
  padding: 1.75rem;
  border-radius: 20px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
}

.insights__card--accent {
  background: var(--brand-primary);
  color: #fff;
}

.feature-stack {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 3rem clamp(1.5rem, 4vw, 3rem);
}

.feature-stack__item {
  background: #fff;
  border-radius: 26px;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  border: 1px solid var(--app-border);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: clamp(1.25rem, 2vw, 2rem);
  align-items: center;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.feature-stack__item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.feature-stack__item.is-reversed .feature-stack__meta {
  order: 2;
}

.feature-stack__item.is-reversed .feature-stack__visual {
  order: 1;
}

.feature-stack__meta h3 {
  margin: 0.5rem 0;
}

.feature-stack__eyebrow-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
  text-transform: none;
}

.feature-stack__visual {
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 24px;
  padding: 1rem;
  border: 1px solid var(--app-border);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.feature-stack__visual img {
  max-width: 92%;
  border-radius: 20px;
  object-fit: contain;
  filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.2));
  transition: transform 0.2s ease;
}

.feature-stack__visual:hover img {
  transform: translateY(-2px);
}

.feature-stack__item[data-accent='Productividad'] .feature-stack__eyebrow-pill {
  border-color: rgba(13, 59, 102, 0.25);
  background: rgba(13, 59, 102, 0.08);
  color: var(--brand-primary);
}

.feature-stack__item[data-accent='Adopción'] .feature-stack__eyebrow-pill {
  border-color: rgba(37, 99, 235, 0.25);
  background: rgba(37, 99, 235, 0.08);
  color: #2350ad;
}

.feature-stack__item[data-accent='Escalabilidad'] .feature-stack__eyebrow-pill {
  border-color: rgba(79, 70, 229, 0.25);
  background: rgba(79, 70, 229, 0.08);
  color: #4f46e5;
}

@media (max-width: 860px) {
  .feature-stack__item {
    grid-template-columns: 1fr;
  }

  .feature-stack__item.is-reversed .feature-stack__meta,
  .feature-stack__item.is-reversed .feature-stack__visual {
    order: initial;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feature-stack__item,
  .feature-stack__visual img {
    transition: none !important;
    transform: none !important;
  }
}

.trust {
  text-align: center;
}

.trust__logos {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 1.5rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.cta-footer {
  background: #e7f4ff;
}

.cta-card {
  background: #fff;
  padding: 2.5rem;
  border-radius: 26px;
  border: 1px solid var(--app-border);
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
  box-shadow: var(--shadow-md);
}

.cta-form {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.cta-form input {
  border: 1px solid var(--app-border);
  border-radius: 999px;
  padding: 0.85rem 1.25rem;
  min-width: 220px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 860px) {
  .hero__nav-links {
    display: none;
  }

  .hero__nav {
    padding: 0;
  }

  .hero__visual {
    order: -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand__mascot,
  .btn,
  .hero__visual-panel,
  .hero__nav-links a::after,
  .offers article {
    animation: none !important;
    transition: none !important;
  }
}
</style>
