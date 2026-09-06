import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { ENTITY_COLORS, REL_COLORS } from '../theme'

cytoscape.use(cola)


// ============================================================
// ENTITY COLOR HELPER
// ============================================================

function getEntityColor(type) {
  if (!type) return '#7c8798'

  // Normalize the type coming from the backend.
  const normalizedType = String(type).trim().toLowerCase()

  // Explicit colors for every important entity type.
  // These act as a fallback even if theme.js is missing a key.
  const fallbackColors = {
    person: '#4ade80',
    location: '#38bdf8',
    organization: '#a78bfa',
    vehicle: '#f59e0b',
    account: '#facc15',
    phone: '#f87171',
    place: '#22d3ee',
  }

  // First try the existing theme.
  const themeColor =
    ENTITY_COLORS[type] ||
    ENTITY_COLORS[normalizedType] ||
    ENTITY_COLORS[
      normalizedType.charAt(0).toUpperCase() +
      normalizedType.slice(1)
    ]

  // Otherwise use our explicit fallback.
  return themeColor || fallbackColors[normalizedType] || '#7c8798'
}


// ============================================================
// RELATIONSHIP COLOR HELPER
// ============================================================

function getRelationshipColor(type) {
  if (!type) return '#3a4356'

  const normalizedType = String(type).trim()

  return (
    REL_COLORS[type] ||
    REL_COLORS[normalizedType] ||
    '#3a4356'
  )
}


// ============================================================
// CONVERT GRAPH DATA TO CYTOSCAPE ELEMENTS
// ============================================================

function toElements(nodes, edges) {
  const els = []

  // ----------------------------------------------------------
  // NODES
  // ----------------------------------------------------------

  for (const n of nodes) {
    els.push({
      group: 'nodes',

      data: {
        id: n.id,
        label: n.name,
        type: n.type,
        degree: n.degree || 1,
        confidence: n.confidence,
      },
    })
  }


  // ----------------------------------------------------------
  // EDGES
  // ----------------------------------------------------------

  const seen = new Set()

  for (const e of edges) {
    if (seen.has(e.id)) continue

    seen.add(e.id)

    els.push({
      group: 'edges',

      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight || 1,
        confidence: e.confidence,
      },
    })
  }

  return els
}


// ============================================================
// GRAPH VIEW
// ============================================================

export default function GraphView({
  nodes = [],
  edges = [],
  onSelectNode,
  onExpandNode,
  selectedId,
  highlightPathIds = [],
  className = '',
}) {

  const containerRef = useRef(null)
  const cyRef = useRef(null)


  // ==========================================================
  // CREATE CYTOSCAPE INSTANCE
  // ==========================================================

  useEffect(() => {

    if (!containerRef.current) return


    const cy = cytoscape({

      container: containerRef.current,

      elements: [],

      minZoom: 0.15,
      maxZoom: 3,

      wheelSensitivity: 0.25,


      // ======================================================
      // GRAPH STYLING
      // ======================================================

      style: [

        // ----------------------------------------------------
        // NODES
        // ----------------------------------------------------

        {
          selector: 'node',

          style: {

            // IMPORTANT:
            // Color is determined by the entity TYPE.
            'background-color': (ele) =>
              getEntityColor(
                ele.data('type')
              ),

            'label': 'data(label)',

            'color': '#cbd2e1',

            'font-size': 10,

            'text-valign': 'bottom',

            'text-margin-y': 4,

            'text-outline-width': 0,

            'width': (ele) =>
              16 +
              Math.min(
                28,
                (ele.data('degree') || 1) * 1.6
              ),

            'height': (ele) =>
              16 +
              Math.min(
                28,
                (ele.data('degree') || 1) * 1.6
              ),

            'border-width': 2,

            'border-color': '#0b0e14',

            'overlay-opacity': 0,
          },
        },


        // ----------------------------------------------------
        // SELECTED NODE
        // ----------------------------------------------------

        {
          selector: 'node:selected',

          style: {

            'border-width': 3,

            'border-color': '#f1f4f9',
          },
        },


        // ----------------------------------------------------
        // DIMMED ELEMENTS
        // ----------------------------------------------------

        {
          selector: '.dimmed',

          style: {
            opacity: 0.12,
          },
        },


        // ----------------------------------------------------
        // HIGHLIGHTED NODE
        // ----------------------------------------------------

        {
          selector: '.highlighted',

          style: {

            'border-color': '#f5a524',

            'border-width': 4,
          },
        },


        // ----------------------------------------------------
        // EDGES
        // ----------------------------------------------------

        {
          selector: 'edge',

          style: {

            'width': (ele) =>
              Math.max(
                1,
                Math.min(
                  6,
                  Math.log2(
                    (ele.data('weight') || 1) + 1
                  )
                )
              ),

            'line-color': (ele) =>
              getRelationshipColor(
                ele.data('type')
              ),

            'target-arrow-color': (ele) =>
              getRelationshipColor(
                ele.data('type')
              ),

            'target-arrow-shape': 'triangle',

            'arrow-scale': 0.7,

            'curve-style': 'bezier',

            'opacity': 0.65,
          },
        },


        // ----------------------------------------------------
        // PATH HIGHLIGHT
        // ----------------------------------------------------

        {
          selector: 'edge.path-highlight',

          style: {

            'line-color': '#f5a524',

            'target-arrow-color': '#f5a524',

            'width': 4,

            'opacity': 1,
          },
        },
      ],
    })


    cyRef.current = cy


    // ========================================================
    // NODE CLICK
    // ========================================================

    cy.on(
      'tap',
      'node',
      (evt) => {
        onSelectNode?.(
          evt.target.id()
        )
      }
    )


    // ========================================================
    // NODE DOUBLE CLICK
    // ========================================================

    cy.on(
      'dbltap',
      'node',
      (evt) => {
        onExpandNode?.(
          evt.target.id()
        )
      }
    )


    // ========================================================
    // BACKGROUND CLICK
    // ========================================================

    cy.on(
      'tap',
      (evt) => {

        if (evt.target === cy) {
          onSelectNode?.(null)
        }

      }
    )


    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      cy.destroy()
      cyRef.current = null
    }

  }, [])


  // ==========================================================
  // UPDATE GRAPH DATA
  // ==========================================================

  useEffect(() => {

    const cy = cyRef.current

    if (!cy) return


    const els = toElements(
      nodes,
      edges
    )


    cy.elements().remove()

    cy.add(els)


    // ========================================================
    // LAYOUT
    // ========================================================

    const layout = cy.layout({

      name:
        nodes.length > 250
          ? 'cose'
          : 'cola',

      animate:
        nodes.length <= 250,

      randomize: true,

      fit: true,

      padding: 40,

      nodeSpacing: 12,

      edgeLength: 90,

      maxSimulationTime: 2000,
    })


    layout.run()

  }, [nodes, edges])


  // ==========================================================
  // SELECTED NODE UPDATE
  // ==========================================================

  useEffect(() => {

    const cy = cyRef.current

    if (!cy) return


    cy.nodes().unselect()


    if (selectedId) {

      const n =
        cy.getElementById(
          selectedId
        )

      if (n && n.length) {
        n.select()
      }
    }

  }, [selectedId])


  // ==========================================================
  // PATH HIGHLIGHTING
  // ==========================================================

  useEffect(() => {

    const cy = cyRef.current

    if (!cy) return


    cy.elements()
      .removeClass(
        'dimmed highlighted'
      )
      .removeClass(
        'path-highlight'
      )


    if (
      highlightPathIds &&
      highlightPathIds.length > 1
    ) {

      cy.elements()
        .addClass('dimmed')


      const idSet =
        new Set(
          highlightPathIds
        )


      // Highlight nodes in path.
      cy.nodes().forEach(
        (n) => {

          if (
            idSet.has(
              n.id()
            )
          ) {

            n.removeClass(
              'dimmed'
            )

            n.addClass(
              'highlighted'
            )
          }

        }
      )


      // Highlight edges in path.
      for (
        let i = 0;
        i < highlightPathIds.length - 1;
        i++
      ) {

        const a =
          highlightPathIds[i]

        const b =
          highlightPathIds[i + 1]


        cy.edges(
          `[source = "${a}"][target = "${b}"], [source = "${b}"][target = "${a}"]`
        )
          .removeClass('dimmed')
          .addClass('path-highlight')
      }

    }

  }, [highlightPathIds])


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
    />
  )
}


// ============================================================
// FIT AND CENTER
// ============================================================

export function fitAndCenter(cy) {
  cy?.fit(
    undefined,
    40
  )
}