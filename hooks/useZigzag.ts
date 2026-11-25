
import { useEffect, type RefObject } from 'react'

/**
 * Draws the scrolling zigzag lines into `svgRef` while `active` is true.
 * Paths are created imperatively (60fps updates would be wasteful through React state)
 * and removed again on cleanup.
 *
 * Time is driven by a virtual clock that only advances while frames are rendered
 * (and by at most MAX_FRAME_DELTA_MS per frame). requestAnimationFrame pauses in
 * background tabs, so using wall-clock time would make every point jump far off
 * screen when the tab regains focus.
 */


/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const Y_STEP = 58
const SEGMENT_LENGTH = 90
const ANGLE = 20

const COLOR_1 = '#d9dbe2'
const COLOR_2 = '#e9e9e9'

const SVG_NS = 'http://www.w3.org/2000/svg'
const MAX_FRAME_DELTA_MS = 100

const DESKTOP_LAYOUT_SCALE = 16 / 11
const MOBILE_QUERY = '(max-width: 768px)'

/* -------------------------------------------------------------------------- */
/* Types and helpers                                                          */
/* -------------------------------------------------------------------------- */

type Point = {
  x0: number
  y0: number
  x: number
  y: number
  t0: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(v, 1))

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Draws animated scrolling zigzag lines into an SVG element.
 *
 * @param svgRef Reference to the SVG element.
 * @param active Whether the animation should be running.
 */
export function useZigzag(
  svgRef: RefObject<SVGSVGElement | null>,
  active: boolean = true,
) {
  useEffect(() => {
    const svg = svgRef.current
    if (!active || !svg) return

    // Preserve the original desktop scale(16/11) viewport behavior.
    const updateViewBox = () => {
      const k = window.matchMedia(MOBILE_QUERY).matches
        ? 1
        : DESKTOP_LAYOUT_SCALE

      const w = window.innerWidth
      const h = window.innerHeight

      svg.setAttribute(
        'viewBox',
        `${w / 2 - w / (2 * k)} 0 ${w / k} ${h / k}`,
      )
    }

    updateViewBox()
    window.addEventListener('resize', updateViewBox)

    const tan = Math.tan((ANGLE * Math.PI) / 180)

    const rows = Math.ceil(window.innerHeight / Y_STEP)
    const cols = Math.ceil(window.innerWidth / SEGMENT_LENGTH)

    const lines: Point[][] = []
    const paths: SVGPathElement[] = []

    // Virtual clock in milliseconds.
    let clock = 0
    let lastFrameTime = performance.now()

    /* ---------------------------------------------------------------------- */
    /* Initial pattern                                                        */
    /* ---------------------------------------------------------------------- */

    for (let i = 0; i < rows; i++) {
      const yOffset = i * Y_STEP
      const color = i % 2 === 0 ? COLOR_1 : COLOR_2

      let pathData = ''
      let x = 0
      let y = yOffset
      let alternator = 1

      const points: Point[] = []

      for (let c = 0; c < cols; c++) {
        const xNext = x + SEGMENT_LENGTH

        const triangleWave = alternator * SEGMENT_LENGTH * tan
        alternator *= -1

        const lerpY = clamp01(xNext / window.innerWidth)
        const sineWave =
          Math.sin(lerpY * (Math.PI / 2)) * triangleWave

        const yNext = yOffset + sineWave / 2

        pathData += `L ${xNext} ${yNext} `

        points.push({
          x,
          y,
          x0: x,
          y0: y,
          t0: clock,
        })

        x = xNext
        y = yNext
      }

      const path = document.createElementNS(SVG_NS, 'path')

      path.setAttribute('d', `M 0 ${yOffset} ${pathData}`)
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '40')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-linejoin', 'round')
      path.setAttribute('class', 'zigzag-line')

      svg.appendChild(path)

      lines.push(points)
      paths.push(path)
    }

    /* ---------------------------------------------------------------------- */
    /* Animation helpers                                                      */
    /* ---------------------------------------------------------------------- */

    const createNewColumn = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i]
        const prev = points[points.length - 1]

        const xNext = prev.x + SEGMENT_LENGTH
        const middleY = i * Y_STEP

        const alternator = prev.y < middleY ? 1 : -1
        const triangleWave = alternator * SEGMENT_LENGTH * tan

        const yNext = middleY + triangleWave / 2

        points.push({
          x0: xNext,
          y0: yNext,
          x: xNext,
          y: yNext,
          t0: clock,
        })
      }
    }

    const removeFrontColumn = () => {
      for (const points of lines) {
        if (points.length > 1) {
          points.shift()
        }
      }
    }

    const update = () => {
      let createNew = false
      let removeFront = false

      for (let i = 0; i < lines.length; i++) {
        const points = lines[i]
        const middleY = i * Y_STEP

        for (const p of points) {
          const t = (clock - p.t0) / 1000

          p.x = p.x0 - t * 30 - Math.exp(t * 0.14)

          const lerpY = clamp01(p.x / window.innerWidth)

          p.y =
            (p.y0 - middleY) *
              Math.sin(lerpY * (Math.PI / 2)) +
            middleY
        }

        if (
          points[points.length - 1].x <
          window.innerWidth + SEGMENT_LENGTH
        ) {
          createNew = true
        }

        if (points[0].x < -SEGMENT_LENGTH * 20) {
          removeFront = true
        }
      }

      if (createNew) createNewColumn()
      if (removeFront) removeFrontColumn()
    }

    const render = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i]

        let d = `M ${points[0].x} ${points[0].y} `

        for (let j = 1; j < points.length; j++) {
          d += `L ${points[j].x} ${points[j].y} `
        }

        paths[i].setAttribute('d', d)
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Animation loop                                                         */
    /* ---------------------------------------------------------------------- */

    let raf = requestAnimationFrame(function loop(ts) {
      raf = requestAnimationFrame(loop)

      const delta = Math.min(
        Math.max(ts - lastFrameTime, 0),
        MAX_FRAME_DELTA_MS,
      )

      lastFrameTime = ts
      clock += delta

      update()
      render()
    })

    /* ---------------------------------------------------------------------- */
    /* Cleanup                                                                */
    /* ---------------------------------------------------------------------- */

    return () => {
      cancelAnimationFrame(raf)

      window.removeEventListener('resize', updateViewBox)

      svg.removeAttribute('viewBox')

      for (const path of paths) {
        path.remove()
      }
    }
  }, [svgRef, active])
}
