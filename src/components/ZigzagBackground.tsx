'use client'

import { useRef } from 'react'
import { observer } from 'mobx-react-lite'
import appStore from '@/src/stores/AppStore'
import { useZigzag } from '@/src/hooks/useZigzag'

export default observer(function ZigzagBackground() {
  const svgRef = useRef<SVGSVGElement>(null)

  useZigzag(svgRef, appStore.zigzagRevealed)

  return (
    <div id="background">
      <svg id="zigzag-svg" ref={svgRef} />
      <div id="tint" />
      <div id="gradient" />
    </div>
  )
})