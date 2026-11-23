// page.tsx
'use client'

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

type Feature = {
  label: [string] | [string, string]
  description: string
}

// Rendered in grid order (4 columns x 3 rows).

const FEATURES: Feature[] = [
  {
    label: ['AGENTIC', 'CHAT'],
    description:
      'Interact with open-source AI models through a familiar chat interface, with built-in agent capabilities.',
  },
  {
    label: ['SERVERLESS', 'API'],
    description:
      "Access open-source models through a unified chat API, powered by Modal's serverless GPU infrastructure.",
  },
  {
    label: ['TOOL', 'CALLING'],
    description:
      'Extend agents with external tools and capabilities through the Model Context Protocol (MCP).',
  },
  {
    label: ['LONG-TERM', 'MEMORY'],
    description:
      'Give agents persistent memory by retrieving relevant information from past conversations using RAG.',
  },
  {
    label: ['PAYG'],
    description:
      'Pay only for the resources you use, with usage-based pricing for model inference and GPU compute.',
  },
  {
    label: ['MODEL', 'SELECTION'],
    description:
      "Choose from Hugging Face's open-source model ecosystem and deploy models as fully featured AI agents.",
  },
  {
    label: ['GPU', 'SELECTION'],
    description:
      'Choose the GPU hardware used to run model inference through Modal.',
  },
  {
    label: ['PERSISTENT', 'SANDBOX'],
    description:
      'Give agents access to a persistent execution environment that retains files and state between sessions.',
  },
  {
    label: ['CODING', 'AGENTS'],
    description:
      'Use AI coding agents that can inspect, modify, and execute code directly within your codebase.',
  },
  {
    label: ['PROJECTS'],
    description:
      'Organize conversations and resources into workspaces that maintain shared context across multiple conversations.',
  },
  {
    label: ['AGENT', 'ORCHESTRATION'],
    description:
      'Coordinate multiple specialized agents to collaboratively accomplish complex tasks.',
  },
  {
    label: ['DISCORD', 'COMMUNITY'],
    description:
      'Get support, share feedback, and interact with the Go-Wrap community directly on Discord.',
  },
]

// Static, trusted markup (rendered with dangerouslySetInnerHTML) so the highlighted
// <strong> runs stay identical to the original page.
const OS_MODEL_TITLE_HTML = 'WHAT IS <strong class="blue">MODEL WRAPPING</strong>?'

const OS_MODEL_DESCRIPTION_HTML =
  '<strong class="blue">Model wrapping</strong> is the process of taking an <strong class="green">open-source</strong> <strong class="blue">AI model</strong> from <strong class="orange">HuggingFace</strong> and adding essential features like chat interfaces, APIs, <strong class="green">long-term</strong> <strong class="blue">memory</strong>, function calling, and multimodal capabilities to make it fully interactive.<br><br>' +
  '<strong class="red">Services</strong> like <strong class="red">ChatGPT</strong> and <strong class="red">Claude</strong> wrap their <strong class="blue">core models</strong> with these features, turning them into <strong>full AI assistants</strong>, while <strong class="green">open-source</strong> <strong class="orange">models</strong> like <strong class="orange">LLaMA</strong>, <strong class="orange">Mixtral</strong>, or <strong class="orange">Phi</strong> require external infrastructure to achieve the same functionality.<br><br>' +
  '<strong class="green">Go-Wrap</strong> provides this infrastructure, enabling any <strong class="green">open-source</strong> <strong class="blue">model</strong> <strong>to match the capabilities of <strong class="red">proprietary</strong> AI assistants</strong> while maintaining full control over data, customization, and transfer learning.<br><br>' +
  '<strong class="green">By</strong> managing versioning and continuous <strong class="green">fine-tuning</strong>, <strong class="green">Go-Wrap</strong> ensures <strong class="blue">model</strong> <strong class="red">evolution</strong> is <strong class="blue">maintained</strong> through <strong class="green">long-term</strong> <strong class="red">care</strong>, making <strong class="green">open-source</strong> <strong class="blue">AI</strong> <strong class="green">feature-complete</strong>, <strong class="green">self-improving</strong> and <strong class="blue">reliably yours</strong>.'

// Cell highlight cycle: none -> green -> orange -> red -> none
const GREEN = 'rgb(223, 255, 225)'
const ORANGE = 'rgb(250, 234, 214)'
const RED = 'rgb(255, 222, 231)'
const MARK_COLORS = ['', GREEN, ORANGE, RED]

// 12 grid cells + the "OS MODEL" link = 13 markable pieces
const OS_MODEL_INDEX = FEATURES.length
const TOTAL_PIECES = FEATURES.length + 1

const SOUND_TARGETS = 'button, a, .td'
const WAITLIST_ID = 25733

function play(src: string) {
  const audio = new Audio(src)
  audio.play().catch(() => {
    // autoplay can be blocked until the first interaction; ignore
  })
}

/* -------------------------------------------------------------------------- */
/* Zigzag background                                                          */
/* -------------------------------------------------------------------------- */

const Y_STEP = 58
const SEGMENT_LENGTH = 90 // length of zigzag segments
const ANGLE = 20 // angle of zigzag turns (degrees)
const COLOR_1 = '#d9dbe2' // even rows
const COLOR_2 = '#e9e9e9' // odd rows
const SVG_NS = 'http://www.w3.org/2000/svg'
const MAX_FRAME_DELTA_MS = 100 // cap per-frame time advance so hidden tabs don't fast-forward the animation

// The page used to be magnified by 16/11 on desktop (not on mobile) via a CSS transform on
// <body>. The zigzag simulation below is still authored in that original, pre-magnified
// coordinate space, so we map it to the screen with the SVG viewBox instead of a transform.
const DESKTOP_LAYOUT_SCALE = 16 / 11
const MOBILE_QUERY = '(max-width: 768px)'

type Point = { x0: number; y0: number; x: number; y: number; t0: number }

const clamp01 = (v: number) => Math.max(0, Math.min(v, 1))

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
function useZigzag(svgRef: RefObject<SVGSVGElement | null>, active: boolean) {
  useEffect(() => {
    const svg = svgRef.current
    if (!active || !svg) return

    // Show the centered, top-anchored window of simulation space that the old
    // scale(16/11) transform (origin: top center) used to reveal.
    const updateViewBox = () => {
      const k = window.matchMedia(MOBILE_QUERY).matches ? 1 : DESKTOP_LAYOUT_SCALE
      const w = window.innerWidth
      const h = window.innerHeight
      svg.setAttribute('viewBox', `${w / 2 - w / (2 * k)} 0 ${w / k} ${h / k}`)
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

    // --- initial pattern ---
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

        // Lines are fundamentally a triangle wave...
        const triangleWave = alternator * SEGMENT_LENGTH * tan
        alternator *= -1

        // ...attenuated by a sine wave on the left side of the screen.
        const lerpY = clamp01(xNext / window.innerWidth)
        const sineWave = Math.sin(lerpY * (Math.PI / 2)) * triangleWave
        const yNext = yOffset + sineWave / 2

        pathData += `L ${xNext} ${yNext} `
        points.push({ x, y, x0: x, y0: y, t0: clock })
        x = xNext
        y = yNext
      }

      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', `M 0 ${yOffset} ` + pathData)
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

    // --- animation ---
    const createNewColumn = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i]
        const prev = points[points.length - 1]
        const xNext = prev.x + SEGMENT_LENGTH
        const middleY = i * Y_STEP
        const alternator = prev.y < middleY ? 1 : -1
        const triangleWave = alternator * SEGMENT_LENGTH * tan
        // This point is off-screen, so the sine attenuation is maxed out (no-op).
        const yNext = middleY + triangleWave / 2
        points.push({ x0: xNext, y0: yNext, x: xNext, y: yNext, t0: clock })
      }
    }

    const removeFrontColumn = () => {
      for (const points of lines) {
        if (points.length > 1) points.shift()
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
          p.y = (p.y0 - middleY) * Math.sin(lerpY * (Math.PI / 2)) + middleY
        }

        if (points[points.length - 1].x < window.innerWidth + SEGMENT_LENGTH) createNew = true
        if (points[0].x < -SEGMENT_LENGTH * 20) removeFront = true
      }

      if (createNew) createNewColumn()
      if (removeFront) removeFrontColumn()
    }

    const render = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i]
        let d = `M ${points[0].x} ${points[0].y} `
        for (let j = 1; j < points.length; j++) d += `L ${points[j].x} ${points[j].y} `
        paths[i].setAttribute('d', d)
      }
    }

    let raf = requestAnimationFrame(function loop(ts) {
      raf = requestAnimationFrame(loop)

      // Advance the virtual clock only by the (capped) time since the last rendered frame.
      const delta = Math.min(Math.max(ts - lastFrameTime, 0), MAX_FRAME_DELTA_MS)
      lastFrameTime = ts
      clock += delta

      update()
      render()
    })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateViewBox)
      svg.removeAttribute('viewBox')
      for (const path of paths) path.remove()
    }
  }, [svgRef, active])
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

// Icon sizes (and spacing between them) are set in globals.css under `a.icon`.

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
      <path
        d="M12 4.435c-1.989-5.399-12-4.597-12 3.568 0 4.068 3.06 9.481 12 14.997 8.94-5.516 12-10.929 12-14.997 0-8.118-10-8.999-12-3.568z"
        fill="#222227"
        fillOpacity="0.29"
      />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#go-wrap-github-clip)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.00002 0.558136C3.35269 0.558136 0.395081 3.51509 0.395081 7.16307C0.395081 10.0814 2.2876 12.5571 4.91194 13.4306C5.24192 13.4918 5.36311 13.2873 5.36311 13.1129C5.36311 12.9554 5.35699 12.4351 5.35414 11.8832C3.51664 12.2827 3.12891 11.1039 3.12891 11.1039C2.82846 10.3404 2.39555 10.1374 2.39555 10.1374C1.79617 9.72748 2.44072 9.73601 2.44072 9.73601C3.10386 9.7825 3.45321 10.4167 3.45321 10.4167C4.0423 11.4262 4.99835 11.1344 5.37525 10.9657C5.43453 10.5388 5.60571 10.2473 5.7946 10.0824C4.32755 9.9156 2.78525 9.34915 2.78525 6.81832C2.78525 6.09721 3.04338 5.50801 3.46589 5.04535C3.39721 4.8791 3.17113 4.20732 3.52977 3.29754C3.52977 3.29754 4.0843 3.12003 5.34649 3.97457C5.87346 3.82812 6.4386 3.75451 7.00002 3.752C7.56111 3.75451 8.12658 3.8279 8.65453 3.97435C9.91519 3.11981 10.4691 3.29732 10.4691 3.29732C10.8286 4.207 10.6025 4.87889 10.5339 5.04514C10.9574 5.50779 11.2137 6.097 11.2137 6.8181C11.2137 9.35495 9.66855 9.91342 8.19778 10.077C8.4348 10.282 8.64589 10.6841 8.64589 11.3002C8.64589 12.1839 8.63824 12.8952 8.63824 13.1127C8.63824 13.2885 8.75724 13.4945 9.09192 13.4296C11.7147 12.5553 13.6051 10.0803 13.6051 7.16307C13.605 3.51531 10.6477 0.558136 7.00002 0.558136Z"
          fill="#222227"
          fillOpacity="0.29"
        />
        <path
          d="M2.89673 10.0413C2.88219 10.0741 2.83056 10.0839 2.78353 10.0615C2.73541 10.04 2.70861 9.99531 2.72414 9.96239C2.73836 9.92848 2.79009 9.91919 2.83789 9.94183C2.88602 9.96338 2.91336 10.0085 2.89662 10.0414L2.89673 10.0413ZM3.16427 10.3397C3.13287 10.3689 3.0713 10.3554 3.02952 10.3091C2.9862 10.2632 2.97811 10.2016 3.01016 10.172C3.04275 10.1429 3.10247 10.1566 3.14578 10.2026C3.18887 10.2492 3.19741 10.3102 3.16437 10.3398L3.16427 10.3397ZM3.4248 10.72C3.38433 10.7483 3.31805 10.7219 3.27714 10.6632C3.23667 10.6043 3.23667 10.5338 3.27823 10.5057C3.31903 10.4774 3.38433 10.5029 3.42589 10.5611C3.46614 10.6207 3.46614 10.6914 3.4248 10.72ZM3.78147 11.0876C3.74537 11.1276 3.66816 11.1168 3.61172 11.0625C3.55408 11.0092 3.538 10.9334 3.5742 10.8936C3.61095 10.8536 3.6885 10.8647 3.74527 10.9188C3.80291 10.9719 3.8203 11.0478 3.78169 11.0875L3.78147 11.0876ZM4.27366 11.301C4.25758 11.3528 4.18342 11.3763 4.1085 11.3542C4.0338 11.3315 3.98491 11.2711 4.00022 11.2188C4.01553 11.1666 4.09023 11.1422 4.16559 11.1657C4.2403 11.1883 4.28919 11.2484 4.27366 11.301ZM4.8143 11.3405C4.81616 11.395 4.75272 11.44 4.6743 11.4411C4.59522 11.443 4.53123 11.3988 4.53047 11.3452C4.53047 11.2902 4.59259 11.2457 4.67156 11.2442C4.74998 11.2427 4.81441 11.2865 4.81441 11.3404L4.8143 11.3405ZM5.3172 11.255C5.32661 11.308 5.27203 11.3626 5.19405 11.3772C5.11748 11.3914 5.04639 11.3583 5.03655 11.3057C5.02714 11.2513 5.0827 11.1967 5.15926 11.1826C5.23736 11.1691 5.30736 11.2011 5.3172 11.255Z"
          fill="#222227"
          fillOpacity="0.29"
        />
      </g>
      <defs>
        <clipPath id="go-wrap-github-clip">
          <rect width="14" height="14" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      imageRendering="optimizeQuality"
      fillRule="evenodd"
      clipRule="evenodd"
      width="14"
      height="14"
      viewBox="0 0 512 512"
    >
      <defs>
        <mask id="go-wrap-discord-cutout">
          <rect width="512" height="512" fill="white" />
          <path
            fill="black"
            fillRule="nonzero"
            d="M360.932 160.621a250.49 250.49 0 00-62.384-19.182 174.005 174.005 0 00-7.966 16.243 232.677 232.677 0 00-34.618-2.602c-11.569 0-23.196.879-34.623 2.58-2.334-5.509-5.044-10.972-7.986-16.223a252.55 252.55 0 00-62.397 19.222c-39.483 58.408-50.183 115.357-44.833 171.497a251.546 251.546 0 0076.502 38.398c6.169-8.328 11.695-17.193 16.386-26.418a161.718 161.718 0 01-25.813-12.318c2.165-1.569 4.281-3.186 6.325-4.756 23.912 11.23 50.039 17.088 76.473 17.088 26.436 0 52.563-5.858 76.475-17.09 2.069 1.689 4.186 3.306 6.325 4.756a162.642 162.642 0 01-25.859 12.352 183.919 183.919 0 0016.386 26.396 250.495 250.495 0 0076.553-38.391l-.006.006c6.278-65.103-10.724-121.529-44.94-171.558zM205.779 297.63c-14.908 0-27.226-13.53-27.226-30.174 0-16.645 11.889-30.294 27.179-30.294 15.289 0 27.511 13.649 27.249 30.294-.261 16.644-12.007 30.174-27.202 30.174zm100.439 0c-14.933 0-27.202-13.53-27.202-30.174 0-16.645 11.889-30.294 27.202-30.294 15.313 0 27.44 13.649 27.178 30.294-.261 16.644-11.984 30.174-27.178 30.174z"
          />
        </mask>
      </defs>
      <circle cx="256" cy="256" r="256" fill="#222227" fillOpacity="0.29" mask="url(#go-wrap-discord-cutout)" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type SelectedFeature = { kind: 'os-model' } | { kind: 'feature'; index: number }

export default function Page() {
  const [marks, setMarks] = useState<number[]>(() => Array(TOTAL_PIECES).fill(0))
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<SelectedFeature | null>(null)

  const [gameMode, setGameMode] = useState(false)
  const [playerIndex, setPlayerIndex] = useState(1)

  const [submitted, setSubmitted] = useState(false)
  const [completionSize, setCompletionSize] = useState<{ width: number; height: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const featureDialogRef = useRef<HTMLDialogElement>(null)
  const waitlistDialogRef = useRef<HTMLDialogElement>(null)
  const waitFormRef = useRef<HTMLFormElement>(null)
  const aborted = useRef(false)
  const disableHoverSound = useRef(false)

  const coloredCount = marks.filter(Boolean).length
  const rainbow = coloredCount === TOTAL_PIECES || revealed

  useZigzag(svgRef, revealed)

  // ---- sounds (document-level delegation covers every button / link / cell) ----
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(SOUND_TARGETS)) play('/tap.wav')
    }
    const onMouseOver = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const el = e.target.closest(SOUND_TARGETS)
      if (!el || el.contains(e.relatedTarget as Node | null)) return
      setTimeout(() => {
        if (!disableHoverSound.current) play('/bloop.wav')
      }, 0)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('mouseover', onMouseOver)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('mouseover', onMouseOver)
    }
  }, [])

  const handleDialogClose = () => {
    play('/swipe+place.wav')
    disableHoverSound.current = true
    setTimeout(() => {
      disableHoverSound.current = false
    }, 16)
  }

  const closeOnBackdropClick = (e: ReactMouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.close()
  }

  // ---- feature grid -------------------------------------------------------------
  const handleFeatureClick = (markIndex: number, feature: SelectedFeature) => {
    setSelected(feature)
    featureDialogRef.current?.showModal()

    if (gameMode) return // in game mode the cells show the board instead of cycling

    const next = marks.map((m, i) => (i === markIndex ? (m + 1) % MARK_COLORS.length : m))
    setMarks(next)

    if (next.filter(Boolean).length === TOTAL_PIECES) {
      if (marks[markIndex] === 0) play('/pew.wav')
      setRevealed(true)
    }
  }

  // ---- hidden game mode: Cmd+E, then arrow keys ---------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'e') {
        setGameMode(true)
        play('/bloop.wav')
        return
      } else if (e.ctrlKey && e.key === 't') {
        setRevealed(true)
        play('/pew.wav')
      }
      if (!gameMode) return

      // While a feature description is open, Enter closes it. close() fires the dialog's
      // onClose handler, which plays swipe+place.
      if (featureDialogRef.current?.open) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (!e.repeat) featureDialogRef.current.close()
        }
        return
      }

      // Ignore game input while the waitlist dialog is open.
      if (waitlistDialogRef.current?.open) return

      const cols = 4
      const rows = FEATURES.length / cols

      if (e.key.startsWith('Arrow')) play('/bloop.wav')

      switch (e.key) {
        case 'Enter':
          // Open the description of the highlighted cell.
          e.preventDefault()
          if (e.repeat) break
          play('/tap.wav')
          handleFeatureClick(playerIndex, { kind: 'feature', index: playerIndex })
          break
        case 'ArrowUp':
          // Wrap from the top row to the bottom row of the same column.
          setPlayerIndex((p) => (p - cols < 0 ? p + (rows - 1) * cols : p - cols))
          break
        case 'ArrowDown':
          // Wrap from the bottom row to the top row of the same column.
          setPlayerIndex((p) => (p + cols >= FEATURES.length ? p % cols : p + cols))
          break
        case 'ArrowRight':
          setPlayerIndex((p) => {
            const n = p + 1
            return n % cols === 0 ? n - cols : n
          })
          break
        case 'ArrowLeft':
          setPlayerIndex((p) => {
            const n = p - 1
            if (n < 0) return cols - 1
            return n % cols === cols - 1 ? n + cols : n
          })
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameMode, playerIndex])

  const cellBackground = (i: number) => {
    if (gameMode) return i === playerIndex ? RED : GREEN
    return MARK_COLORS[marks[i]] || undefined
  }

  // ---- waitlist -------------------------------------------------------------------
  const handleWaitlistSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    aborted.current = false

    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>

    try {
      const res = await fetch('https://api.getwaitlist.com/api/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          waitlist_id: WAITLIST_ID,
          metadata: {
            first_name: values.firstName,
            last_name: values.lastName,
            suggestions: values.suggestions,
            website: values.website,
            coloredPieces: coloredCount,
          },
        }),
      })
      await res.json()
    } catch (err) {
      console.error('Waitlist signup failed', err)
      return
    }

    if (aborted.current) return

    // Keep the "thank you" panel the same size as the form it replaces.
    const wrap = waitFormRef.current
    if (wrap) setCompletionSize({ width: wrap.offsetWidth, height: wrap.offsetHeight })

    setSubmitted(true)
    form.reset()
    play('/chirp.wav')
  }

  const selectedFeature = selected?.kind === 'feature' ? FEATURES[selected.index] : null
  const isOsModel = selected?.kind === 'os-model'

  return (
    <>
      <div id="background">
        <svg id="zigzag-svg" ref={svgRef} />
        <div id="tint" />
        <div id="gradient" />
      </div>

      <div className="page">
        <div className="container-socials-wrap">
          <div className="container">
            <h1>WELCOME TO GO-WRAP</h1>

            <div className="subtitle">
              <h2>
                WRAP ANY{' '}
                <a
                  className="model-wrapping-link"
                  style={{ backgroundColor: MARK_COLORS[marks[OS_MODEL_INDEX]] || undefined }}
                  onClick={() => handleFeatureClick(OS_MODEL_INDEX, { kind: 'os-model' })}
                >
                  OS MODEL
                </a>
                .
              </h2>
              <h2>
                MAKE IT{' '}
                <span id="rainbow-text" className={rainbow ? 'rainbow-text' : undefined}>
                  FEATURE COMPLETE
                </span>
                .
              </h2>
            </div>

            <div className="table">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.label.join(' ')}
                  className="td"
                  style={{ backgroundColor: cellBackground(i) }}
                  onClick={() => handleFeatureClick(i, { kind: 'feature', index: i })}
                >
                  {feature.label.map((line, j) => (
                    <Fragment key={line}>
                      {j > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>

            <div className="buttons">
              <button type="button" onClick={() => waitlistDialogRef.current?.showModal()}>
                <span>WAIT</span>
              </button>
              <button type="button" disabled className="sub-button">
                <span>GO</span>
              </button>
            </div>
          </div>

          <div className="socials">
            <div className="footer">
              <a className="handle" href="https://x.com/tay2win" target="_blank" rel="noopener noreferrer">
                @taylorgoolsby
              </a>
            </div>
            <div className="flex row">
              <a
                href="https://bento.me/taylorgoolsby"
                target="_blank"
                rel="noopener noreferrer"
                className="icon heart"
              >
                <HeartIcon />
              </a>
              <a
                className="icon github"
                href="https://github.com/taylorgoolsby/go-wrap"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon />
              </a>
              <a
                className="icon discord"
                href="https://discord.gg/CPpB8H6SJr"
                target="_blank"
                rel="noopener noreferrer"
              >
                <DiscordIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="footer future">
          DESIGNED FOR:
          <br />- WRAPPING OPEN-SOURCE MODELS
          <br />- BUILDING AI KNOWLEDGE BASES
          <br />- DEVELOPING EVOLVING AI BOTS
        </div>
      </div>

      <dialog
        id="feature-dialog"
        ref={featureDialogRef}
        className={isOsModel ? 'model-wrapping-dialog' : undefined}
        onClick={closeOnBackdropClick}
        onClose={handleDialogClose}
      >
        <div className={`go-wrap feature-dialog-wrap${isOsModel ? ' model-wrapping-dialog-wrap' : ''}`}>
          {isOsModel ? (
            <>
              <span className="feature-dialog-title" dangerouslySetInnerHTML={{ __html: OS_MODEL_TITLE_HTML }} />
              <span
                className="feature-dialog-description"
                dangerouslySetInnerHTML={{ __html: OS_MODEL_DESCRIPTION_HTML }}
              />
            </>
          ) : (
            <>
              <span className="feature-dialog-title">{selectedFeature?.label.join(' ')}</span>
              <span className="feature-dialog-description">{selectedFeature?.description}</span>
            </>
          )}
        </div>
      </dialog>

      <dialog
        id="waitlist-dialog"
        ref={waitlistDialogRef}
        onClick={closeOnBackdropClick}
        onClose={() => {
          aborted.current = true
          handleDialogClose()
        }}
      >
        <form
          id="wait-wrap"
          className="go-wrap"
          ref={waitFormRef}
          style={submitted ? { display: 'none' } : undefined}
          onSubmit={handleWaitlistSubmit}
        >
          <span className="form-title">WAITLIST</span>
          <div className="flex row">
            <label htmlFor="firstName">FIRST NAME: </label>
            <input type="text" id="firstName" name="firstName" required />
          </div>
          <div className="flex row">
            <label htmlFor="lastName">LAST NAME: </label>
            <input type="text" id="lastName" name="lastName" required />
          </div>
          <div className="flex row">
            <label htmlFor="email">EMAIL: </label>
            <input type="email" id="email" name="email" required />
          </div>
          <div className="flex row">
            <label htmlFor="website">WEBSITE: </label>
            <input type="text" id="website" name="website" />
          </div>
          <div className="flex row">
            <label htmlFor="suggestions">
              WHAT CAN AI
              <br />
              DO FOR YOU?{' '}
            </label>
            <textarea id="suggestions" name="suggestions" maxLength={300} placeholder="Can it ..." />
          </div>
          <button type="submit" className="small-button">
            JOIN
          </button>
        </form>
        <div className="go-wrap completion" style={submitted ? { display: 'flex', ...completionSize } : undefined}>
          <span>THANK YOU FOR JOINING THE WAITLIST</span>
          <span>WE WILL NOTIFY YOU WHEN WE ARE READY</span>
        </div>
      </dialog>
    </>
  )
}