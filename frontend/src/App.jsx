import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function TimeWheel({ label, unit, value, values, onStep, disabled }) {
  const drag = useRef(null);
  const index = values.indexOf(value);
  const adjacentValue = (offset) => values[index + offset];

  function stepFromWheel(event) {
    if (disabled) return;
    onStep(event.deltaY < 0 ? 1 : -1);
  }

  function startDrag(event) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, distance: 0 };
  }

  function moveDrag(event) {
    if (disabled || !drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current.distance += event.movementY;
    while (drag.current.distance <= -30) {
      onStep(1);
      drag.current.distance += 30;
    }
    while (drag.current.distance >= 30) {
      onStep(-1);
      drag.current.distance -= 30;
    }
  }

  function endDrag(event) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <div
      className="time-wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      aria-valuenow={value}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onStep(event.key === "ArrowUp" ? 1 : -1);
      }}
      onWheel={stepFromWheel}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="time-wheel-neighbor">{adjacentValue(-1) ?? ""}</span>
      <span className="time-wheel-selected">
        <strong>{value}</strong>
        <small>{typeof unit === "function" ? unit(value) : unit}</small>
      </span>
      <span className="time-wheel-neighbor">{adjacentValue(1) ?? ""}</span>
    </div>
  );
}

function RestaurantCard({ restaurant, index }) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = `restaurant-title-${restaurant.id}`;
  const detailsId = `restaurant-details-${restaurant.id}`;
  const demoDetails = [
    { label: "Espera estimada", value: ["10–20 min", "15–25 min", "20–30 min"][index % 3] },
    { label: "Ideal para", value: ["una salida casual", "una comida en grupo", "probar algo distinto"][index % 3] },
    { label: "Tip de visita", value: ["Pregunta por sus especialidades", "Revisa disponibilidad antes de ir", "Confirma el horario en días festivos"][index % 3] },
  ];

  useEffect(() => {
    if (!expanded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") setExpanded(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [expanded]);

  function toggleExpanded() {
    setExpanded((current) => !current);
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || chatLoading) return;

    const history = messages.slice(-20).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setQuestion("");
    setChatError("");
    setChatLoading(true);

    try {
      let response = await fetch(`${API_URL}/restaurantes/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          question: prompt,
          history,
        }),
      });

      if (response.status === 404) {
        const restaurantContext = {
          nombre: restaurant.nombre,
          municipio: restaurant.municipio,
          horario: restaurant.horario,
          tipo_cocina: restaurant.tipo_cocina,
          platillos_estrella: restaurant.platillos_estrella,
          precio_promedio_mxn: restaurant.precio_promedio_mxn,
          estacionamiento: restaurant.estacionamiento,
          acceso_transporte_publico: restaurant.acceso_transporte_publico,
          como_llegar_publico: restaurant.como_llegar_publico,
          alergenos: restaurant.alergenos,
          ambiente: restaurant.ambiente,
        };
        const fallbackPrompt = [
          "Eres Chef Regio. Responde en español, con amabilidad y de forma breve.",
          "Contesta sobre este restaurante usando solamente los datos indicados. No inventes detalles, direcciones, servicios, rutas ni disponibilidad. Si falta el dato, dilo y recomienda confirmarlo con el restaurante.",
          `Datos del restaurante: ${JSON.stringify(restaurantContext)}`,
          `Conversación previa: ${JSON.stringify(history)}`,
          `Pregunta actual: ${prompt}`,
        ].join("\n\n");
        response = await fetch(`${API_URL}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: fallbackPrompt }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "No se pudo obtener una respuesta.");
      }
      const answer = data.answer || data.respuesta;
      if (!answer) {
        throw new Error("El asistente no devolvió una respuesta.");
      }
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (requestError) {
      setChatError(
        requestError.message || "No se pudo conectar con el asistente. Inténtalo de nuevo.",
      );
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <article className="restaurant-card">
      <div
        ref={triggerRef}
        className="restaurant-card-trigger"
        role="button"
        tabIndex={0}
        aria-labelledby={titleId}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={toggleExpanded}
        onKeyDown={handleTriggerKeyDown}
      >
        <div className={`restaurant-art art-${index + 1}`} aria-hidden="true">
          <span>{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="restaurant-info">
          <div className="restaurant-topline">
            <span className="restaurant-city">{restaurant.municipio}</span>
            <span className="restaurant-price">${restaurant.precio_promedio_mxn} MXN</span>
          </div>
          <h3 id={titleId}>{restaurant.nombre.replace(/^EJEMPLO\s*-\s*/i, "")}</h3>
          <p className="restaurant-distance">
            {restaurant.ubicacion_aproximada
              ? `Ubicación aproximada: ${restaurant.municipio}`
              : <><span aria-hidden="true">↗</span> A {restaurant.distancia_km} km de ti</>}
            <span className="restaurant-hours">{restaurant.horario}</span>
          </p>
          {restaurant.tiempo_total_minutos != null && (
            <p className="restaurant-time-estimate">
              Ida {restaurant.tiempo_ida_minutos} min · comida {restaurant.tiempo_comida_minutos} min
              · regreso {restaurant.tiempo_regreso_minutos} min
              <strong>Total aprox. {restaurant.tiempo_total_minutos} min</strong>
            </p>
          )}
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
      </div>
      {expanded && createPortal(
        <div className="restaurant-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setExpanded(false);
        }}>
          <section
            className="restaurant-modal"
            id={detailsId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-modal`}
          >
            <header className="restaurant-modal-header">
              <div>
                <span className="section-kicker">PERFIL DEL LUGAR · {restaurant.municipio}</span>
                <h2 id={`${titleId}-modal`}>{restaurant.nombre.replace(/^EJEMPLO\s*-\s*/i, "")}</h2>
              </div>
              <button
                ref={closeButtonRef}
                className="restaurant-modal-close"
                type="button"
                aria-label="Cerrar detalles"
                onClick={() => setExpanded(false)}
              >
                ×
              </button>
            </header>
            <div className="restaurant-modal-content">
              <div className="restaurant-profile">
                <div className="details-heading">
                  <h3>Información del restaurante</h3>
                  <a
                    className="directions-link"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.nombre} ${restaurant.municipio}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Cómo llegar <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <dl className="restaurant-facts">
                  <div><dt>Cocina</dt><dd>{(restaurant.tipo_cocina || []).join(", ") || "No disponible"}</dd></div>
                  <div><dt>Platillos destacados</dt><dd>{(restaurant.platillos_estrella || []).join(", ") || "No disponible"}</dd></div>
                  <div><dt>Horario registrado</dt><dd>{restaurant.horario || "No disponible"}</dd></div>
                  <div><dt>Ambiente</dt><dd>{restaurant.ambiente || "No disponible"}</dd></div>
                  <div><dt>Precio promedio</dt><dd>{restaurant.precio_promedio_mxn ? `$${restaurant.precio_promedio_mxn} MXN por persona` : "No disponible"}</dd></div>
                  <div><dt>Estacionamiento</dt><dd>{restaurant.estacionamiento ? "Sí, según el catálogo" : "No confirmado"}</dd></div>
                  <div><dt>Opción ligera</dt><dd>{restaurant.opcion_ligera ? "Sí, según el catálogo" : "No registrada"}</dd></div>
                  <div><dt>Alérgenos registrados</dt><dd>{(restaurant.alergenos || []).join(", ") || "No disponibles"}</dd></div>
                  <div><dt>Transporte público</dt><dd>{restaurant.como_llegar_publico || "No disponible"}</dd></div>
                </dl>
                <p className="demo-disclaimer">
                  Estos datos son ejemplos de demostración; no están confirmados por el restaurante.
                </p>
                <div className="demo-facts">
                  {demoDetails.map((detail) => (
                    <div key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>
                  ))}
                </div>
              </div>
              <section className="restaurant-chat" aria-label={`Asistente de ${restaurant.nombre}`}>
            <div className="chat-heading">
              <span className="chat-avatar" aria-hidden="true">CR</span>
              <div><strong>Pregúntale a Chef Regio</strong><small>Respuestas sobre este restaurante</small></div>
            </div>
            <div className="chat-messages" aria-live="polite">
              {messages.length === 0 && (
                <p className="chat-welcome">
                  ¡Hola! Puedo ayudarte con el horario, el menú o las opciones para llegar.
                </p>
              )}
              {messages.map((message, messageIndex) => (
                <p className={`chat-message ${message.role}`} key={`${message.role}-${messageIndex}`}>
                  {message.content}
                </p>
              ))}
              {chatLoading && <p className="chat-message assistant">Estoy buscando la mejor respuesta…</p>}
              {chatError && <p className="chat-error" role="alert">{chatError}</p>}
            </div>
            <form className="chat-form" onSubmit={handleChatSubmit}>
              <label className="visually-hidden" htmlFor={`chat-question-${restaurant.id}`}>
                Pregunta sobre {restaurant.nombre}
              </label>
              <input
                id={`chat-question-${restaurant.id}`}
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ej. ¿Cómo llego en transporte público?"
                maxLength={500}
              />
              <button type="submit" disabled={chatLoading || !question.trim()}>
                {chatLoading ? "…" : "Enviar"}
              </button>
            </form>
              </section>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </article>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationError, setLocationError] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState(90);

  const availableHours = Math.floor(Number(availableMinutes) / 60);
  const remainingMinutes = Number(availableMinutes) % 60;

  function updateAvailableHours(step) {
    setAvailableMinutes((current) => {
      const nextHours = Math.max(0, Math.min(4, Math.floor(Number(current) / 60) + step));
      return Math.min(240, Math.max(30, nextHours * 60 + (Number(current) % 60)));
    });
  }

  function updateAvailableMinutes(step) {
    setAvailableMinutes((current) => {
      const nextMinutes = Math.max(0, Math.min(55, Number(current) % 60 + step * 5));
      return Math.min(240, Math.max(30, Math.floor(Number(current) / 60) * 60 + nextMinutes));
    });
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleMunicipalityChange(value) {
    updateForm("municipio_origen", value);
    setLocation(null);
    setLocationMessage("");
    setLocationError(false);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Tu navegador no permite compartir la ubicación.");
      setLocationError(true);
      return;
    }

    setLocating(true);
    setLocationMessage("");
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitud: coords.latitude, longitud: coords.longitude });
        setLocationMessage("Listo. Buscaremos opciones cerca de tu ubicación.");
        setLocationError(false);
        setLocating(false);
      },
      (geolocationError) => {
        const messages = {
          1: "Permite el acceso a tu ubicación para buscar restaurantes cercanos.",
          2: "No pudimos determinar tu ubicación. Inténtalo de nuevo.",
          3: "La solicitud de ubicación tardó demasiado. Inténtalo de nuevo.",
        };
        setLocationMessage(
          messages[geolocationError.code] ||
            "No pudimos obtener tu ubicación. Inténtalo de nuevo.",
        );
        setLocationError(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
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
      ...(location || {}),
      ...(quickMode
        ? {
            tiempo_disponible_minutos: Number(availableMinutes),
          }
        : {}),
    };

    try {
      const response = await fetch(
        `${API_URL}${quickMode ? "/recomendar-rapido" : "/recomendar"}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        },
      );
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
              <div className="location-field">
                <label className="field">
                  <span>¿En qué municipio estás?</span>
                  <select
                    value={form.municipio_origen}
                    onChange={(event) => handleMunicipalityChange(event.target.value)}
                  >
                    {MUNICIPIOS.map((municipio) => (
                      <option key={municipio}>{municipio}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="location-button"
                  type="button"
                  onClick={handleUseLocation}
                  disabled={locating}
                >
                  {locating
                    ? "Buscando ubicación..."
                    : location
                      ? "Actualizar mi ubicación"
                      : "Usar mi ubicación"}
                </button>
                {locationMessage && (
                  <p
                    className={`location-message ${locationError ? "location-error" : ""}`}
                    role={locationError ? "alert" : "status"}
                  >
                    {locationMessage}
                  </p>
                )}
              </div>

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

            <section className={`quick-time-panel ${quickMode ? "active" : ""}`}>
              <div className="quick-time-visual">
                <div className="quick-time-copy">
                  <strong>¿Tienes poco tiempo?</strong>
                  <small>Encuentra lugares cercanos que alcancen para ir, comer y volver.</small>
                </div>
                <button
                  className="quick-mode-toggle"
                  type="button"
                  aria-pressed={quickMode}
                  onClick={() => setQuickMode((current) => !current)}
                >
                  {quickMode ? "Desactivar" : "Tengo poco tiempo"}
                </button>
                <div className="quick-time-picker" aria-label="Tiempo disponible">
                  <TimeWheel
                    label="Horas disponibles"
                    unit={(hours) => hours === 1 ? "hora" : "horas"}
                    value={availableHours}
                    values={[0, 1, 2, 3, 4]}
                    onStep={updateAvailableHours}
                    disabled={!quickMode}
                  />
                  <TimeWheel
                    label="Minutos disponibles"
                    unit="min"
                    value={remainingMinutes}
                    values={Array.from({ length: 12 }, (_, index) => index * 5)}
                    onStep={updateAvailableMinutes}
                    disabled={!quickMode}
                  />
                </div>
              </div>
              {quickMode && (
                <div className="quick-time-options">
                  <p className="quick-time-hint">Desliza cada rueda para ajustar horas y minutos</p>
                  <p className="quick-time-disclaimer">
                    Solo indica tu tiempo libre. Para estimar el plan completo reservamos 45 min para comer; el traslado se aproxima con la distancia y tu medio de transporte. No incluye tráfico en tiempo real.
                  </p>
                </div>
              )}
            </section>

            <div className="submit-row">
              <span className="privacy-note">
                Tus preferencias solo se usan para encontrar tu recomendación.
              </span>
              <button className="submit-button" type="submit" disabled={loading}>
                {loading
                  ? quickMode ? "Calculando tus opciones..." : "Buscando tu lugar..."
                  : quickMode ? "Buscar por tiempo disponible" : "Encuentra mi lugar"}
                {loading && <span aria-hidden="true">…</span>}
              </button>
            </div>
          </form>
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
                <h2>
                  {result.candidatos.length
                    ? result.modo === "rapido"
                      ? "Opciones que caben en tu tiempo"
                      : "Tu antojo ya tiene destino"
                    : result.modo === "rapido"
                      ? "No encontramos una opción dentro de ese tiempo"
                      : "Hoy toca buscar un poquito más"}
                </h2>
              </div>
              <span className="result-count">
                {String(result.candidatos.length).padStart(2, "0")} LUGARES
              </span>
            </div>
            {result.candidatos.length > 0 && (
              <div className="restaurant-list">
                {result.candidatos.map((restaurant, index) => (
                  <RestaurantCard
                    restaurant={restaurant}
                    index={index}
                    key={`${restaurant.id}-${restaurant.nombre}`}
                  />
                ))}
              </div>
            )}
            {result.modo === "rapido" && (
              <p className="quick-results-note">
                El total incluye 45 min estimados para comer y transporte {form.transporte === "auto" ? "en auto" : "público"}; puede variar según ruta y tráfico.
              </p>
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
