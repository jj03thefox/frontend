import type { AccessorFunction, ChangeFlags, DefaultProps } from '@deck.gl/core'
import type { PathLayerProps } from '@deck.gl/layers'
import { PathLayer } from '@deck.gl/layers'
import type { NumericArray } from '@math.gl/core'

import type { ThinningLevels } from '@globalfishingwatch/api-client'
import type { TrackSegment } from '@globalfishingwatch/api-types'
import type { Bbox } from '@globalfishingwatch/data-transforms'
import { wrapBBoxLongitudes } from '@globalfishingwatch/data-transforms'
import type { VesselTrackData, VesselTrackGraphExtent } from '@globalfishingwatch/deck-loaders'

import { getUTCDateTime } from '../../utils'
import { colorToVec, hexToDeckColor } from '../../utils/colors'
import { MAX_FILTER_VALUE } from '../layers.config'

import { DEFAULT_HIGHLIGHT_COLOR_VEC } from './vessel.config'
import type { GetSegmentsFromDataParams } from './vessel.utils'
import { generateVesselGraphSteps, getSegmentsFromData, VESSEL_GRAPH_STEPS } from './vessel.utils'

export type VesselsColorByProperty = 'track' | 'speed' | 'elevation'
export type VesselsColorByValue = 1 | 2 | 3
export const COLOR_BY: Record<VesselsColorByProperty, VesselsColorByValue> = {
  track: 1,
  speed: 2,
  elevation: 3,
}

/** Properties added by track. */
export type _VesselTrackLayerProps<DataT = any> = {
  id: string
  /**
   * The start time of the track in milliseconds
   * @default 0
   */
  startTime: number
  /**
   * The end time of the track in milliseconds
   * @default 0
   */
  endTime: number
  /**
   * Uses the startDate and endDate to define the start and end time of the track without any chunk
   * @default false
   */
  strictTimeRange?: boolean
  /**
   * The start time to highlight the track in milliseconds
   * @default 0
   */
  highlightStartTime?: number
  /**
   * The end time to highlight the track in milliseconds
   * @default 0
   */
  highlightEndTime?: number
  /**
   * The time to highlight the track in milliseconds
   * @default 0
   */
  hoveredTime?: number
  /**
   * The start time of an event to thicken the track in milliseconds
   * @default 0
   */
  highlightEventStartTime?: number
  /**
   * The end time of an event to thicken the track in milliseconds
   * @default 0
   */
  highlightEventEndTime?: number
  /**
   * The low speed filter
   * @default 0
   */
  minSpeedFilter?: number
  /**
   * The high speed filter
   * @default 999999999999999
   */
  maxSpeedFilter?: number
  /**
   * The low speed filter
   * @default -999999999999999
   */
  minElevationFilter?: number
  /**
   * The high speed filter
   * @default 999999999999999
   */
  maxElevationFilter?: number
  // /**
  //  * Color to be used as a highlight path
  //  * @default [255, 255, 255, 255]
  //  */
  // getHighlightColor?: Accessor<DataT, Color | Color[]>
  /**
   * Timestamp accessor.
   */
  getTimestamp?: AccessorFunction<DataT, NumericArray>
  getSpeed?: AccessorFunction<DataT, NumericArray>
  getElevation?: AccessorFunction<DataT, NumericArray>
  /**
   * Callback on data changed to update
   */
  onDataChange?: (dataChange: ChangeFlags['dataChanged']) => void
  /**
   * Track API url accessor.
   */
  trackUrl?: string
  /**
   * Track API url accessor.
   */
  colorBy?: VesselsColorByProperty
  /**
   * Tracks thinning config {[minZoomLevel]: params }
   * e.g. To apply Insane between 0 and 4 zoom levels, and Aggresive for higher
   * { 0: ThinningLevels.Insane, 4: ThinningLevels.Aggressive }
   */
  trackThinningZoomConfig?: Record<number, ThinningLevels>
  /**
   * Domain for the speed or elevation graph
   */
  trackGraphExtent?: VesselTrackGraphExtent
}

function generateShaderColorSteps({
  property,
  operation,
  stepsNum = VESSEL_GRAPH_STEPS,
}: {
  property: 'vSpeed' | 'vElevation'
  operation: '>=' | '<='
  stepsNum?: number
}) {
  return [...Array(stepsNum)]
    .map((_, index) => {
      if (index === stepsNum - 1) {
        return `{ color = track.color${index}; }`
      }
      return `if (${property} ${operation} track.value${index}) { color = track.color${index}; }`
    })
    .join(' else ')
}

// Example of how to use pass an accesor to the shaders
// not needed anymore as the highlighted color is fixed
// const DEFAULT_HIGHLIGHT_COLOR_RGBA = [255, 255, 255, 255] as Color

const defaultProps: DefaultProps<VesselTrackLayerProps> = {
  _pathType: 'open',
  endTime: { type: 'number', value: 0, min: 0 },
  startTime: { type: 'number', value: 0, min: 0 },
  highlightStartTime: { type: 'number', value: 0, min: 0 },
  highlightEndTime: { type: 'number', value: 0, min: 0 },
  highlightEventStartTime: { type: 'number', value: 0, min: 0 },
  highlightEventEndTime: { type: 'number', value: 0, min: 0 },
  minSpeedFilter: { type: 'number', value: -MAX_FILTER_VALUE, min: 0 },
  maxSpeedFilter: { type: 'number', value: MAX_FILTER_VALUE, min: 0 },
  minElevationFilter: { type: 'number', value: -MAX_FILTER_VALUE, min: 0 },
  maxElevationFilter: { type: 'number', value: MAX_FILTER_VALUE, min: 0 },
  getPath: { type: 'accessor', value: () => [0, 0] },
  getTimestamp: { type: 'accessor', value: (d) => d },
  getSpeed: { type: 'accessor', value: (d) => d },
  getElevation: { type: 'accessor', value: (d) => d },
  onDataChange: { type: 'function', value: () => {} },
  getColor: { type: 'accessor', value: () => [255, 255, 255, 100] },
  // getHighlightColor: { type: 'accessor', value: DEFAULT_HIGHLIGHT_COLOR_RGBA },
  trackUrl: { type: 'accessor', value: '' },
}

/** All properties supported by track. */
export type VesselTrackLayerProps<DataT = any> = _VesselTrackLayerProps<DataT> &
  PathLayerProps<DataT>

const uniformBlock = `
  uniform trackUniforms {
    uniform float startTime;
    uniform float endTime;
    uniform float highlightStartTime;
    uniform float highlightEndTime;
    uniform float highlightEventStartTime;
    uniform float highlightEventEndTime;
    uniform float minSpeedFilter;
    uniform float maxSpeedFilter;
    uniform float minElevationFilter;
    uniform float maxElevationFilter;
    uniform float discardOnFilter;
    uniform float value0;
    uniform float value1;
    uniform float value2;
    uniform float value3;
    uniform float value4;
    uniform float value5;
    uniform float value6;
    uniform float value7;
    uniform float value8;
    uniform float value9;
    uniform vec4 color0;
    uniform vec4 color1;
    uniform vec4 color2;
    uniform vec4 color3;
    uniform vec4 color4;
    uniform vec4 color5;
    uniform vec4 color6;
    uniform vec4 color7;
    uniform vec4 color8;
    uniform vec4 color9;
    uniform float colorBy;
  } track;
`

const trackLayerUniforms = {
  name: 'track',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    startTime: 'f32',
    endTime: 'f32',
    highlightStartTime: 'f32',
    highlightEndTime: 'f32',
    highlightEventStartTime: 'f32',
    highlightEventEndTime: 'f32',
    minSpeedFilter: 'f32',
    maxSpeedFilter: 'f32',
    minElevationFilter: 'f32',
    maxElevationFilter: 'f32',
    discardOnFilter: 'f32',
    value0: 'f32',
    value1: 'f32',
    value2: 'f32',
    value3: 'f32',
    value4: 'f32',
    value5: 'f32',
    value6: 'f32',
    value7: 'f32',
    value8: 'f32',
    value9: 'f32',
    color0: 'vec4<f32>',
    color1: 'vec4<f32>',
    color2: 'vec4<f32>',
    color3: 'vec4<f32>',
    color4: 'vec4<f32>',
    color5: 'vec4<f32>',
    color6: 'vec4<f32>',
    color7: 'vec4<f32>',
    color8: 'vec4<f32>',
    color9: 'vec4<f32>',
    colorBy: 'f32',
  },
}

export class VesselTrackLayer<DataT = any, ExtraProps = Record<string, unknown>> extends PathLayer<
  DataT,
  VesselTrackLayerProps & ExtraProps
> {
  static layerName = 'VesselTrackLayer'
  static defaultProps = defaultProps

  getShaders() {
    const shaders = super.getShaders()
    shaders.modules = [...(shaders.modules || []), trackLayerUniforms]
    shaders.inject = {
      'vs:#decl': /*glsl*/ `
        in float instanceTimestamps;
        in float instanceSpeeds;
        in float instanceElevations;
        out float vTime;
        out float vSpeed;
        out float vElevation;
        `,
      'vs:DECKGL_FILTER_SIZE': /*glsl*/ `
        vTime = instanceTimestamps;
        vSpeed = instanceSpeeds;
        vElevation = instanceElevations;
        if (vTime > track.highlightEventStartTime && vTime < track.highlightEventEndTime) {
          size *= 4.0;
        }
        `,
      'vs:#main-end': /*glsl*/ `
        if(vTime > track.highlightStartTime && vTime < track.highlightEndTime) {
          gl_Position.z = 1.0;
        }
      `,
      'fs:#decl': /*glsl*/ `
        in float vTime;
        in float vSpeed;
        in float vElevation;
      `,
      // Drop the segments outside of the time window
      'fs:#main-start': /*glsl*/ `
        if (vTime < track.startTime || vTime > track.endTime) {
          discard;
        }
      `,
      'fs:DECKGL_FILTER_COLOR': /*glsl*/ `
        if(track.colorBy == ${COLOR_BY.speed}.0) {
          ${generateShaderColorSteps({
            property: 'vSpeed',
            operation: '<=',
          })}
        } else if(track.colorBy == ${COLOR_BY.elevation}.0){
          ${generateShaderColorSteps({
            property: 'vElevation',
            operation: '>=',
          })}
        }

        if (vSpeed < track.minSpeedFilter ||
            vSpeed > track.maxSpeedFilter ||
            vElevation < track.minElevationFilter ||
            vElevation > track.maxElevationFilter)
        {
          if (track.discardOnFilter == 1.0) {
            discard;
          } else {
            color.a = 0.25;
          }
        }

        // TODO how can we fade the rest of the track?
        // if(vTime <= track.highlightEventStartTime || vTime >= track.highlightEventEndTime) {
        //   color.a = 0.25;
        // }

        if (vTime > track.highlightStartTime && vTime < track.highlightEndTime) {
          color = vec4(${DEFAULT_HIGHLIGHT_COLOR_VEC.join(',')});
        }
      `,
    }
    return shaders
  }

  initializeState() {
    super.initializeState()
    const attributeManager = this.getAttributeManager()
    if (attributeManager) {
      attributeManager.addInstanced({
        timestamps: {
          size: 1,
          accessor: 'getTimestamp',
          shaderAttributes: {
            instanceTimestamps: {},
          },
        },
      })
      attributeManager.addInstanced({
        speeds: {
          size: 1,
          accessor: 'getSpeed',
          shaderAttributes: {
            instanceSpeeds: {},
          },
        },
      })
      attributeManager.addInstanced({
        elevations: {
          size: 1,
          accessor: 'getElevation',
          shaderAttributes: {
            instanceElevations: {},
          },
        },
      })
    }
  }

  draw(params: any) {
    const {
      startTime,
      endTime,
      trackGraphExtent,
      highlightStartTime = 0,
      highlightEndTime = 0,
      highlightEventStartTime = 0,
      highlightEventEndTime = 0,
      minSpeedFilter = -MAX_FILTER_VALUE,
      maxSpeedFilter = MAX_FILTER_VALUE,
      minElevationFilter = -MAX_FILTER_VALUE,
      maxElevationFilter = MAX_FILTER_VALUE,
      colorBy,
      id,
    } = this.props

    const steps =
      trackGraphExtent && colorBy ? generateVesselGraphSteps(trackGraphExtent, colorBy) : []

    const values = steps.reduce(
      (acc, step, index) => {
        acc[`value${index}`] = step.value
        return acc
      },
      {} as Record<string, number>
    )

    const colors = steps.reduce(
      (acc, step, index) => {
        acc[`color${index}`] = (hexToDeckColor(step.color) as number[]).map((c) => colorToVec(c))
        return acc
      },
      {} as Record<string, number[]>
    )

    if (this.state.model) {
      this.state.model.shaderInputs.setProps({
        track: {
          startTime,
          endTime,
          highlightStartTime,
          highlightEndTime,
          highlightEventStartTime,
          highlightEventEndTime,
          minSpeedFilter,
          maxSpeedFilter,
          minElevationFilter,
          maxElevationFilter,
          discardOnFilter: id.includes('interactive') ? 1.0 : 0.0,
          colorBy: colorBy ? COLOR_BY[colorBy] : COLOR_BY.track,
          ...values,
          ...colors,
        },
      })
    }

    super.draw(params)
  }

  getData(): VesselTrackData {
    return this.props.data as VesselTrackData
  }

  getSegments(param = {} as GetSegmentsFromDataParams): TrackSegment[] {
    return getSegmentsFromData(this.props.data as VesselTrackData, param)
  }

  getGraphExtent(graph: 'speed' | 'elevation'): VesselTrackGraphExtent {
    const selector = graph === 'speed' ? 'getSpeed' : 'getElevation'
    const extent = (this.props.data as VesselTrackData).attributes?.[selector]?.extent
    return extent
  }

  getBbox(params = {} as { startDate?: number | string; endDate?: number | string }) {
    const data = this.props.data as VesselTrackData
    const positions = data.attributes?.getPath?.value
    const positionsSize = data.attributes?.getPath?.size
    const timestamps = data.attributes?.getTimestamp?.value
    if (!timestamps?.length) return null

    const startDate = params?.startDate
      ? getUTCDateTime(params.startDate).toMillis()
      : this.props.startTime
    const endDate = params?.endDate ? getUTCDateTime(params.endDate).toMillis() : this.props.endTime
    const firstPointIndex = timestamps.findIndex((t) => t > startDate)
    const lastPointIndex = timestamps.findLastIndex((t) => t < endDate)
    if (firstPointIndex === -1 || lastPointIndex === -1 || firstPointIndex > lastPointIndex) {
      return null
    }
    if (firstPointIndex === lastPointIndex) {
      const index = firstPointIndex
      const longitude = positions[index * positionsSize]
      const latitude = positions[index * positionsSize + 1]
      return wrapBBoxLongitudes([longitude, latitude, longitude, latitude])
    }

    const bounds = [Infinity, Infinity, -Infinity, -Infinity] as Bbox
    for (let index = firstPointIndex; index <= lastPointIndex + 1; index++) {
      const longitude = positions[index * positionsSize]
      const latitude = positions[index * positionsSize + 1]
      if (longitude < bounds[0]) bounds[0] = longitude
      if (longitude > bounds[2]) bounds[2] = longitude
      if (latitude < bounds[1]) bounds[1] = latitude
      if (latitude > bounds[3]) bounds[3] = latitude
    }
    return wrapBBoxLongitudes(bounds)
  }
}
