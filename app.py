import streamlit as st

from recomendador import MUNICIPIOS, recomendar

st.title("¿Dónde comemos? (AMM)")

with st.form("formulario"):
    municipio = st.selectbox("¿En qué municipio estás?", list(MUNICIPIOS.keys()))
    distancia = st.slider("¿Qué tan lejos quieres ir? (km)", 1, 40, 10)
    gustos = st.text_input("¿Qué se te antoja? (separa con comas)", "tacos, carne asada")
    alergias = st.multiselect(
        "Alergias", ["mariscos", "gluten", "lacteos", "nueces", "huevo"]
    )
    presupuesto = st.number_input("Presupuesto por persona (MXN)", 50, 2000, 250, step=50)
    dieta = st.checkbox("Estoy cuidando calorías / hago dieta")
    hambre = st.radio("¿Qué tanta hambre tienes?", ["poca", "media", "mucha"], index=1, horizontal=True)
    transporte = st.radio(
        "¿Cómo te mueves?", ["auto", "transporte_publico"], horizontal=True,
        format_func=lambda x: "Tengo auto" if x == "auto" else "Transporte público",
    )
    ambiente = st.radio(
        "Ambiente", ["me_da_igual", "tematico", "tranquilo"], horizontal=True,
        format_func=lambda x: {"me_da_igual": "Me da igual", "tematico": "Temático", "tranquilo": "Tranquilo, sin distracciones"}[x],
    )
    enviar = st.form_submit_button("Recomiéndame")

if enviar:
    form = {
        "municipio_origen": municipio,
        "distancia_max_km": distancia,
        "gustos": [g.strip() for g in gustos.split(",") if g.strip()],
        "alergias": alergias,
        "presupuesto_mxn": presupuesto,
        "dieta": dieta,
        "hambre": hambre,
        "transporte": transporte,
        "ambiente": ambiente,
    }
    with st.spinner("Pensando..."):
        candidatos, respuesta = recomendar(form)

    st.subheader("Recomendación")
    st.markdown(respuesta)

    # Útil para probar: compara lo que dijo el modelo contra lo que recibió
    with st.expander("Candidatos que recibió el modelo (para depurar)"):
        st.json(candidatos)