## Stack

El mismo que en HealthStats. Supabase, TypeScript, React, Shadcn, Recharts. También: mismo layout, mismos colores, etc.

Esta app trabajará mucho con fechas y hará cálculos de tiempo. Es importante que trabajemos con [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal), no con Date. Quiero exponerme a la nueva API de Temporal.

## Idea

Quiero estandarizar rutinas. Qué estamos solucionando:

- Dejar de tomar microdecisiones sobre cual es el siguiente paso, con la carga mental que eso implica.
- Poder compartir la aplicación de mis rutinas con mi psicólogo, en lugar de escribirlas cada día a mano y enviarlas por WhatsApp.
- Añadir trazabilidad y medibilidad a mis rutinas.
- A menudo hago varias cosas a la vez, creyendo que ahorro tiempo. Pero quiero dejar de hacer esto ya que creo que me resta demasiado foco y acabo perdiendo mucho foco. Prefiero centrarme en una sola cosa y hacerla rápido.

## Entities

### PlannedAction

Una acción que se supone que se debe hacer.

Varios Plans de un mismo Routine pueden tener la misma PlannedAction, con el mismo ID.

Propiedades:

- id: string. UUID.
- name: string. Nombre de la acción (por ejemplo: Desayunar").
- equipment: string. Materiales necesarios para cada cosa (por ejemplo: para desayunar, necesito tener comida). En muchos casos será un string vacío.

### PlannedActionWithLength

- plannedActionId: string. FK de PlannedAction.
- length: integer. Duración en minutos (por ejemplo, 15 significaría que se prevén 15 minutos para desayunar).

### Plan

- start. Hora de inicio, o null (si la hora de inicio es variable).
- plannedActions: PlannedActionWithLength[]. De esta forma, diferentes Plans pueden tener un mismo PlannedAction, pero con diferente length.
- periodStart. Primer día en que se aplica esta Routine.
- periodEnd. Último día en que se aplica esta Routine, o null.

La información que contendría sería algo así, para una Routine llamada "Mañanas":

```
start: 7:00
periodStart: 2028-09-02
periodEnd: null
actions (la "Hora inicio" no está en la base de datos, pero se computaría a menudo en la app cuando la Routine tiene periodStart):

| name                             | length | equipment                     | Hora inicio |
| -------------------------------- | ------ | ----------------------------- | ----------- |
| Levantarse                       | 5      |                               | 7:00        |
| Ducha                            | 10     |                               | 7:05        |
| Secarse y peinarse               | 7      |                               | 7:15        |
| Hacer la cama                    | 5      |                               | 7:22        |
| Vestirse                         | 5      |                               | 7:27        |
| Desayuno                         | 15     | Comida: desayuno              | 7:32        |
| Preparar bocadillo y ensalada    | 10     | Comida: bocadillos y ensalada | 7:47        |
| Recoger cocina                   | 5      |                               | 7:57        |
| Lavarse los dientes              | 3      |                               | 8:02        |
| Mochila, llaves, abrigo, zapatos | 5      |                               | 8:05        |
| Colchón para imprevistos         | 5      |                               | 8:10        |
| Salir de casa                    | 0      |                               | 8:15        |
| Llegar al trabajo                | 20     |                               | 8:35        |
```

Otro ejemplo, para una Routine llamada "After work":

```
start: null
periodStart: 2028-09-02
periodEnd: null
actions:

| name                             | length | equipment          |
| -------------------------------- | ------ | ------------------ |
| Salir del trabajo                | 0      |                    |
| Ir al gimnasio                   | 15     |                    |
| Cambiarse                        | 5      | Ropa de deporte    |
| Entrenamiento                    | 60     | Gimnasio           |
| Ducharse                         | 10     | Toalla, gel        |
| Vestirse                         | 5      |                    |
| Ir al supermercado               | 10     |                    |
| Hacer la compra                  | 20     | Lista de la compra |
| Volver a casa                    | 15     |                    |
| Guardar la compra                | 10     | Nevera, despensa   |
| Colchón para imprevistos         | 10     |                    |
| Llegar a casa / rutina terminada | 0      |                    |
```

### Routine

Un conjunto de Plans que comparten un mismo propósito (pie ejemplo, "Mañanas" podría representar la rutina desde que el usuario se despierta hasta que sale de casa al trabajo).

Una Routine puede tener varios Plans porque eventualmente puedo querer cambiar cosas como la hora de comienzo o la lista de PlannedActions, según la fecha (si estoy de vacaciones, cambio de trabajo, etc). Pero al mismo tiempo, deben estar agrupadas en un mismo Routine, ya que a muchos efectos son comparables (por ejemplo: quiero que se muestren en los mismos gráficos). Los diferentes Plans de una misma Routine deberían compartir PlannedActions para mantenerlos unidos.

Other possible names: schedule | habit | pattern | system | sequence | formula | plan

Propiedades:

- name: string. Nombre de la Routine.
- plans: Plan[]. 

### Round

Lo que el usuario registra que hace en un día concreto para un Routine concreto.

Other possible names: iteration | turn | run | session | edition

Para cada Routine, puede haber 0 o 1 instancias de Round por día.

Propiedades:

- date. La fecha en que ocurrió.
- actions: PerformedAction[]
- comments: string. Comentarios del usuario en texto libre.
- routine: string. El ID de la Routine.

### PerformedAction

Cada una de las acciones que el usuario ha registrado en un Round.

- name: string. Nombre 
- length: integer. Duración en minutos.
- plannedActionId: string|null. El ID del PlannedAction que se encuentra en el Routine de este Round. Si es una acción "libre", entonces esto es null.
- comments: string. Para comentarios en texto libre.

Esto es parecido a PlannedActionWirhLength, pero no sé cómo se podría encajar de forma elegante y mantenible - habría que pensarlo.

## UI: layout

Todo es de ShadCn.

Es mobile-first.

Las tab bars están abajo, fijas. Todas al alcance del pulgar, con grandes touch areas, para prevenir toques accidentales. Cada una tiene un icono y un nombre corto. Son las siguientes:

- Home (/views)
- New round (/rounds/new)
- Routines (/routines)
- Settings (/settings)

## UI: pages

### /rounds

Muestra una tabla con todas las Rounds registradas. Como /logs en HealthStats. Cada Round tiene su dropdown menu donde el usuario puede editar (un simple link a /rounds/:id) o borrar (tras modal tipo "confirm").

### /rounds/new y /rounds/:id (privada)

Aquí se registra cada Round.

Si el usuario no está conectado, ve un [componente Empty](https://ui.shadcn.com/docs/components/base/empty) que le invita a iniciar sesión en /login.

En el resto de casos, el usuario ve lo siguiente.

Una primera parte que decidirá qué Plan estamos registrando.

- Un [date picker](https://ui.shadcn.com/docs/components/base/date-picker) para modificar la fecha del Round. Por defecto, está seleccionado el día actual. Es editable, pero solo se podrán seleccionar las fechas disponibles dentro del Routine seleccionado.
- "Routine selector". Un [select, aligned with trigger](https://ui.shadcn.com/docs/components/base/select#align-item-with-trigger), que muestra las Routines disponibles para el día seleccionado. El usuario selecciona la Routine para la que va a registrar un Round.

Si por algún motivo no hay ningún Plan que en la fecha y Routine seleccionados la segunda y tercera parte ya no se ven; en lugar de eso, el usuario ve un componente Empty que le invita a crear una rutina en /routines/new.

Una segunda parte sobre el Round actual.

- "Live timeline". Un pequeño timeline temporal proporcional que permite al usuario ver cómo va el Round en comparación con el Routine, en tiempo real. Muestra:
	- El Routine. Cada PlannedAction tiene un color determinado.
	- Las PerformedActions ya registradas. Cada PlannedAction tiene el mismo color que en la parte de Routine; y las acciones que no son PlannedAction tienen un color gris.
- Un [dropdown menu](https://ui.shadcn.com/docs/components/base/dropdown-menu) con opciones de edición para el current Action.
	- Si estamos en /rounds/new, un texto discreto que pone "About to create a Round". Si estamos en /round/:id, un link que pone "Save and create new round", que simplemente es un link a /round/new
	- "Back". Para retroceder una edición.
	- "Forward". Para avanzar una edición.
	- "Lock screen". Un toggle que hace que, mientras está marcado, la pantalla del móvil no se bloquee.
	- "Clear Routine". Para borrar la current Routine entera (solo enabled si había algo guardado). Esta acción se puede deshacer.
- "Comments for this Round". Un campo de texto para que el usuario añada texto libre para este Round.

Una tercera parte sobre la acción que se está haciendo en este momento.

- "Current Action". Un [Combobox](https://ui.shadcn.com/docs/components/base/combobox) con las PlannedAction del Routine ordenadas. Siempre debe mostrar la acción que se supone que el usuario está haciendo en ese momento. Los [items del combobox son customizados](https://ui.shadcn.com/docs/components/base/combobox#custom-items-1) para mostrar no solo el nombre sino también cuándo debería empezar y cuánto debería durar, y si está ya marcada como hecha o no. Al ser un combobox, el usuario también puede poner texto libre, añadiendo así una acción que no sea PlannedAction. 
- Un pequeño botón de "Clear action". Para borrar la current Action (solo enabled si había algo guardado de la current Action).
- "Finish action". Un botón muy grande. Al hacer click:
	- Registra el fin de la acción seleccionada en "Current action" en ese momento.
	- Pasamos a la siguiente PlannedAction, haciendo que "Current action" se actualice.
- "Finished action". Un pequeño input de HH:MM con botón. El usuario puede marcar la acción actual como marcada, pero no en este momento, sino en una hora diferente.
- "Comments for this Action". Para que el usuario añada comentarios sobre esta Action, si quiere.

La idea es reducir al máximo el tiempo y esfuerzo de hacer esto. Mientras llevo a cabo las acciones de un Round (por ejemplo: me estoy duchando, lavando los dientes, preparando la comida...), marcar cada paso en el móvil es molesto (me estoy esforzando en hacer cosas en el mundo real, y en hacerlas lo más rápido posible). Así que hay que reducir esta fricción al máximo. En un día normal, donde el usuario simplemente hace lo que está en el Routine con en el orden previsto, todo lo que el usuarío haría sería presionar en el botón "Finish action" varias veces (cada vez que termina una acción).

Recordemos que cada rutina se puede realizar una sola vez por día. Así que el usuario no selecciona el Plan dentro del Routine: el Plan se decide según la fecha que sea. Los Plans no se pueden solapar en el tiempo dentro de una Routine. Esto hace que los datos persistan aunque el usuario haya guardado solo la mitad de la rutina.

El usuario puede cambiar "Current action" a acciones que ya había marcado como hechas. Esto permite emmendar errores.

Cada vez que el usuario introduce datos, el Round de ese día se actualiza en la base de datos (recibiendo feedback sobre el proceso y resultado ---tenemos que ver si con un toast o de otra forma).

Al entrar en /round/new, antes de hacer ningún cambio, seguimos en /round/new. En cuanto se hace la primera edición, se genera un ID para este Round, y la ruta pasa a ser /round/:id.

### /routines

Parecido a como funcionan en Rounds, pero para crear Routines. Tenemos que desarrollar esto.

Aquí también es importante que haya filtros. Especialmente para descartar las Routines que no tienen Plans en el presente ni futuro (por lo tanto, antiguas).

### /routines/new y /routines/:id (privada)

Parecido a como funcionan los Rounds, pero para crear Routines. Tenemos que desarrollar esto.

### /views

Tenemos un selector de rutina (select), y un selector de vista (select). Deciden qué se ve.

Estas son las vistas:

#### /views/actions

Gráfico de línea. Cada línea es una PlannedAction. Muestra cuántos segundos he tardado cada día 

#### /views/week

Igual que /view/week en HealthStats. Solo que aquí no vemos las 24 horas de cada dia, solo la sección de horas donde hay items en esa semana.

#### /views/drifts

Un feed para repasar el desvío hacia atrás. Una tarjeta por día, del más reciente al más antiguo, cargando más días al hacer scroll.

Cada tarjeta lleva el mismo timeline que se ve al registrar un Round: el plan justo encima de lo realmente hecho, ambos sobre el mismo eje de segundos desde el inicio del Round. Así el desvío se lee en el borde derecho de la pista de abajo, sin necesidad de números.

En la cabecera de cada tarjeta, el día y su desvío total, enlazando al /rounds/:id de ese día.

Los días sin Round no aparecen: el feed lista Rounds, no días de calendario.

### /settings

Round history: botón para ver /rounds.
Routines: botón para ver /routines.
Botón para iniciar sesión (o cerrar sesión si ya está iniciada; tras modal tipo "confirm").