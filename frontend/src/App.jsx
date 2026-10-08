import React, { useState } from "react";
import MiMapa from "./mapa.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MUNICIPIOS = [
  "Monterrey",
  "San Pedro Garza García",
  "San Nicolás de los Garza",
  "Guadalupe",
  "General Escobedo",
  "Apodaca",
  "Santa Catarina",
  "Juárez",
  "García",
  "Santiago",
];
const ALERGIAS = ["mariscos", "gluten", "lacteos", "nueces", "huevo"];

const initialForm = {
  municipio_origen: "Monterrey",
  distancia_max_km: 10,
  gustos: "",
  alergias: [],
  presupuesto_mxn: 250,
  personas: 2,
  dieta: false,
  hambre: "media",
  transporte: "auto",
  ambiente: "me_da_igual",
};

function OptionGroup({ label, name, value, options, onChange }) {
  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      <div className="choice-row">
        {options.map((option) => (
          <label
            className={`choice ${value === option.value ? "selected" : ""}`}
            key={option.value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RestaurantCard({ restaurant, index }) {
  return (
    <article className="restaurant-card">
      <div className={`restaurant-art art-${index + 1}`} aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="restaurant-info">
        <div className="restaurant-topline">
          <span className="restaurant-city">{restaurant.municipio}</span>
          <span className="restaurant-price">${restaurant.precio_promedio_mxn} MXN</span>
        </div>
        <h3>{restaurant.nombre.replace(/^EJEMPLO\s*-\s*/i, "")}</h3>
        <p className="restaurant-distance">
          <span aria-hidden="true">↗</span> A {restaurant.distancia_km} km de ti
          <span className="restaurant-hours">{restaurant.horario}</span>
        </p>
        <div className="restaurant-tags">
          {(restaurant.tipo_cocina || []).slice(0, 3).map((cuisine) => (
            <span className="tag" key={cuisine}>{cuisine}</span>
          ))}
        </div>
        <p className="restaurant-dish">
          <span>Para probar</span>
          {(restaurant.platillos_estrella || []).slice(0, 2).join(" · ")}
        </p>
        <p className="restaurant-route">
          {restaurant.estacionamiento
            ? "Cuenta con estacionamiento"
            : restaurant.como_llegar_publico}
        </p>
      </div>
    </article>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAllergy(allergy) {
    setForm((current) => ({
      ...current,
      alergias: current.alergias.includes(allergy)
        ? current.alergias.filter((item) => item !== allergy)
        : [...current.alergias, allergy],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const payload = {
      ...form,
      distancia_max_km: Number(form.distancia_max_km),
      presupuesto_mxn: Number(form.presupuesto_mxn),
      gustos: form.gustos.split(",").map((item) => item.trim()).filter(Boolean),
    };

    try {
      const response = await fetch(`${API_URL}/recomendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "No se pudo generar la recomendación.");
      }
      setResult(data);
    } catch (requestError) {
      setError(
        requestError.message ||
          "No se pudo conectar con la API. Verifica que esté en ejecución.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="¿Dónde comemos?, inicio">
          <span>¿dónde<span className="brand-light">comemos?</span></span>
        </a>
        <span className="region-label">
          <span className="region-dot" />
          ÁREA METROPOLITANA DE MONTERREY
        </span>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <h1>¿Dónde<br /><em>comemos?</em></h1>
          </div>
          <div className="hero-doodle" aria-label="Hecho para el antojo">
            <span className="doodle-text">hecho<br />para el<br /><i>antojo</i></span>
          </div>
        </section>

        <section className="form-section" aria-labelledby="form-heading">
          <div className="section-heading">
            <div>
              <span className="section-kicker">TU SIGUIENTE BUEN PLAN</span>
              <h2 id="form-heading">Cuéntanos qué se te antoja</h2>
            </div>
            <span className="step-label">01 <span>/</span> 01</span>
          </div>

          <form className="finder-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>¿En qué municipio estás?</span>
                <select
                  value={form.municipio_origen}
                  onChange={(event) => updateForm("municipio_origen", event.target.value)}
                >
                  {MUNICIPIOS.map((municipio) => (
                    <option key={municipio}>{municipio}</option>
                  ))}
                </select>
              </label>

              <label className="field range-field">
                <span className="field-row">
                  ¿Qué tan lejos quieres ir?
                  <strong>{form.distancia_max_km}<small> km</small></strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={form.distancia_max_km}
                  onChange={(event) => updateForm("distancia_max_km", event.target.value)}
                />
                <span className="range-labels"><span>1 km</span><span>40 km</span></span>
              </label>

              <label className="field">
                <span>¿Qué se te antoja?</span>
                <input
                  type="text"
                  value={form.gustos}
                  onChange={(event) => updateForm("gustos", event.target.value)}
                  placeholder="Ej. tacos, sushi, carne asada"
                />
                <small>Opcional · separa tus antojos con comas</small>
              </label>

              <div className="budget-group">
                <label className="field">
                  <span>Presupuesto por persona</span>
                  <div className="money-input">
                    <span>$</span>
                    <input
                      type="number"
                      min="50"
                      max="2000"
                      step="50"
                      value={form.presupuesto_mxn}
                      onChange={(event) => updateForm("presupuesto_mxn", event.target.value)}
                    />
                    <span className="currency">MXN</span>
                  </div>
                </label>
                <div className="party-size">
                  <span id="party-size-label">¿Cuántas personas van?</span>
                  <div className="stepper" aria-labelledby="party-size-label">
                    <button
                      type="button"
                      aria-label="Quitar una persona"
                      disabled={form.personas <= 1}
                      onClick={() => updateForm("personas", form.personas - 1)}
                    >
                      −
                    </button>
                    <output aria-live="polite">{form.personas}</output>
                    <button
                      type="button"
                      aria-label="Agregar una persona"
                      disabled={form.personas >= 20}
                      onClick={() => updateForm("personas", form.personas + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <fieldset className="field allergy-field">
                <legend>Alergias <small>· selecciona todas las que apliquen</small></legend>
                <div className="allergy-list">
                  {ALERGIAS.map((allergy) => (
                    <label
                      className={`allergy-option ${form.alergias.includes(allergy) ? "checked" : ""}`}
                      key={allergy}
                    >
                      <input
                        type="checkbox"
                        checked={form.alergias.includes(allergy)}
                        onChange={() => toggleAllergy(allergy)}
                      />
                      {allergy}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={`diet-card ${form.dieta ? "active" : ""}`}>
                <span className="diet-copy">
                  <strong>Algo más ligero</strong>
                  <small>Estoy cuidando calorías</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.dieta}
                  onChange={(event) => updateForm("dieta", event.target.checked)}
                />
                <span className="switch" aria-hidden="true" />
              </label>

              <OptionGroup
                label="¿Qué tanta hambre tienes?"
                name="hambre"
                value={form.hambre}
                options={[
                  { value: "poca", label: "Un antojito" },
                  { value: "media", label: "Hambre normal" },
                  { value: "mucha", label: "¡Mucha hambre!" },
                ]}
                onChange={(value) => updateForm("hambre", value)}
              />

              <OptionGroup
                label="¿Cómo te mueves?"
                name="transporte"
                value={form.transporte}
                options={[
                  { value: "auto", label: "Voy en auto" },
                  { value: "transporte_publico", label: "Transporte público" },
                ]}
                onChange={(value) => updateForm("transporte", value)}
              />

              <OptionGroup
                label="¿Qué ambiente se te antoja?"
                name="ambiente"
                value={form.ambiente}
                options={[
                  { value: "me_da_igual", label: "Me da igual" },
                  { value: "tematico", label: "Algo temático" },
                  { value: "tranquilo", label: "Algo tranquilo" },
                ]}
                onChange={(value) => updateForm("ambiente", value)}
              />
            </div>

            <div className="submit-row">
              <span className="privacy-note">
                Tus preferencias solo se usan para encontrar tu recomendación.
              </span>
              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? "Buscando tu lugar..." : "Encuentra mi lugar"}
                {loading && <span aria-hidden="true">…</span>}
              </button>
            </div>
          </form>
        </section>

        <section className="map-section" aria-labelledby="map-heading">
          <div className="section-heading">
            <div>
              <span className="section-kicker">MONTERREY</span>
              <h2 id="map-heading">Explora el mapa</h2>
            </div>
          </div>
          <MiMapa restaurantes={result?.candidatos ?? []} />
        </section>

        {loading && (
          <div className="loading-message" role="status">
            <span className="loader" />
            <div><strong>Buscando algo rico para ti...</strong><small>Chef Regio está pensando en tu antojo.</small></div>
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            <strong>No pudimos encontrar tu recomendación</strong>
            <p>{error}</p>
            <small>Confirma que la API esté activa en {API_URL}.</small>
          </div>
        )}

        {result && (
          <section className="results-section" aria-live="polite">
            <div className="section-heading results-heading">
              <div>
                <span className="section-kicker">HECHO A TU MEDIDA</span>
                <h2>{result.candidatos.length ? "Tu antojo ya tiene destino" : "Hoy toca buscar un poquito más"}</h2>
              </div>
              <span className="result-count">
                {String(result.candidatos.length).padStart(2, "0")} LUGARES
              </span>
            </div>
            {result.candidatos.length > 0 && (
              <div className="restaurant-list">
                {result.candidatos.slice(0, 3).map((restaurant, index) => (
                  <RestaurantCard restaurant={restaurant} index={index} key={restaurant.id} />
                ))}
              </div>
            )}
            <div className="chef-note">
              <div>
                <strong>Consejo</strong>
                <p>{result.respuesta.replaceAll("**", "")}</p>
              </div>
            </div>
            {form.alergias.length > 0 && (
              <p className="allergy-disclaimer">
                Si tienes alergias, confirma siempre los ingredientes y la preparación directamente con el restaurante.
              </p>
            )}
          </section>
        )}
      </main>
        <footer className="footer">
          <span>Un proyecto hecho con antojo</span>
        </footer>
      </div>
  );
}
