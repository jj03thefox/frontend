import { Fragment, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

import type { UrlDataviewInstance } from '@globalfishingwatch/dataviews-client'
import { InputText, Switch } from '@globalfishingwatch/ui-components'

import { useAppDispatch } from 'features/app/app.hooks'
import { debugDatasetsInDataviews, debugRelatedDatasets } from 'features/datasets/datasets.debug'
import { selectAllDatasets } from 'features/datasets/datasets.slice'
import { selectAllDataviewInstancesResolved } from 'features/dataviews/selectors/dataviews.resolvers.selectors'
import { selectIsGFWDeveloper } from 'features/user/selectors/user.selectors'
import { selectLocationQuery } from 'routes/routes.selectors'

import {
  DebugOption,
  FeatureFlag,
  selectDebugOptions,
  selectFeatureFlags,
  toggleFeatureFlag,
  toggleOption,
} from './debug.slice'

import styles from './DebugMenu.module.css'

const DebugMenu: React.FC = () => {
  const dispatch = useAppDispatch()
  const isGFWDeveloper = useSelector(selectIsGFWDeveloper)
  const debugOptions = useSelector(selectDebugOptions)
  const featureFlags = useSelector(selectFeatureFlags)
  const locationQuery = useSelector(selectLocationQuery)
  const [datasetId, setDatasetId] = useState<string>('')
  const dataviews = useSelector(selectAllDataviewInstancesResolved) as UrlDataviewInstance[]
  const datasets = useSelector(selectAllDatasets)

  useEffect(() => {
    if (datasetId?.length > 4) {
      debugDatasetsInDataviews(dataviews, datasetId)
      debugRelatedDatasets(datasets, datasetId)
    }
  }, [datasetId])

  return (
    <div className={styles.row}>
      <section className={styles.section}>
        {isGFWDeveloper && (
          <Fragment>
            <div className={styles.header}>
              <Switch
                id="option_global_reports"
                active={featureFlags.globalReports}
                onClick={() => dispatch(toggleFeatureFlag(FeatureFlag.GlobalReports))}
              />
              <label htmlFor="option_global_reports">
                <strong>Feature flag:</strong> Global reports
              </label>
            </div>
            <p>Activates the global reports feature: aka CVP</p>
            <div className={styles.header}>
              <Switch
                id="option_data_terminology_iframe"
                active={debugOptions.dataTerminologyIframe}
                onClick={() => dispatch(toggleOption(DebugOption.DataTerminologyIframe))}
              />
              <label htmlFor="option_data_terminology_iframe">
                <strong>Feature flag:</strong> Data terminology iframe
              </label>
            </div>
            <p>Activates the data terminology iframe feature</p>
            <div className={styles.header}>
              <Switch
                id="option_areas_on_screen"
                active={debugOptions.areasOnScreen}
                onClick={() => dispatch(toggleOption(DebugOption.AreasOnScreen))}
              />
              <label htmlFor="option_areas_on_screen">
                <strong>Feature flag:</strong> Areas on screen
              </label>
            </div>
            <p>Activates the "Areas on screen" selector in context layers</p>
          </Fragment>
        )}
        <div className={styles.header}>
          <Switch
            id="option_map_stats"
            active={debugOptions.mapStats}
            onClick={() => dispatch(toggleOption(DebugOption.MapStats))}
          />
          <label htmlFor="option_map_stats">Map stats</label>
        </div>
        <p>Show fps and memory stats</p>
        <div className={styles.header}>
          <Switch
            id="option_debug"
            active={debugOptions.debug}
            onClick={() => dispatch(toggleOption(DebugOption.Debug))}
          />
          <label htmlFor="option_debug">Debug tiles</label>
        </div>
        <p>Displays info on tiles useful for debugging.</p>
        <div className={styles.header}>
          <Switch
            id="dataset_relationship"
            active={debugOptions.datasetRelationship}
            onClick={() => dispatch(toggleOption(DebugOption.DatasetRelationship))}
          />
          <label htmlFor="dataset_relationship">Debug dataset relationship</label>
          {debugOptions.datasetRelationship && (
            <InputText
              className={styles.input}
              value={datasetId}
              inputSize="small"
              onChange={(e) => setDatasetId(e.target.value)}
            />
          )}
        </div>
        <p>
          Type the dataset id you want to debug why it is loaded in the workspace and check the
          console log
        </p>
        <div className={styles.header}>
          <Switch
            id="option_thinning"
            active={debugOptions.thinning}
            onClick={() => dispatch(toggleOption(DebugOption.Thinning))}
          />
          <label htmlFor="option_thinning">Track thinning</label>
        </div>
        <p>Don't send any thinning param to tracks API to debug original resolution</p>
        <div className={styles.header}>
          <Switch
            id="option_disable_dataset_hash"
            active={debugOptions.addDatasetIdHash}
            onClick={() => dispatch(toggleOption(DebugOption.DatasetIdHash))}
          />
          <label htmlFor="option_disable_dataset_hash">Include dataset hash in IDs</label>
        </div>
        <p>Dataset IDs includes a hash suffix. Disable to use cleaner IDs without hashes.</p>
        <div className={styles.header}>
          <Switch
            id="option_currents_layer"
            active={debugOptions.currentsLayer}
            onClick={() => dispatch(toggleOption(DebugOption.CurrentsLayer))}
          />
          <label htmlFor="option_currents_layer">Currents layer</label>
        </div>
        <p>Make currents layer available in layer library</p>
      </section>
      <hr className={styles.separation} />
      <section>
        <div className={styles.header}>
          <label>Current URL workspace settings</label>
        </div>
        <textarea
          className={styles.editor}
          defaultValue={JSON.stringify(locationQuery, undefined, 2)}
        />
      </section>
    </div>
  )
}

export default DebugMenu
