import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import type { UrlDataviewInstance } from '@globalfishingwatch/dataviews-client'
import { IconButton } from '@globalfishingwatch/ui-components'

import type { SupportedDatasetSchema } from 'features/datasets/datasets.utils'
import { selectIsGlobalReportsEnabled } from 'features/debug/debug.selectors'
import DatasetFlagField from 'features/workspace/shared/DatasetFlagsField'
import DatasetSchemaField from 'features/workspace/shared/DatasetSchemaField'
import DatasetFilterSource from 'features/workspace/shared/DatasetSourceField'
import ExpandedContainer from 'features/workspace/shared/ExpandedContainer'
import Filters from 'features/workspace/shared/LayerFilters'

import styles from './ReportSummaryTags.module.css'

type LayerPanelProps = {
  index: number
  dataview: UrlDataviewInstance
  availableFields: string[][]
}

export default function ReportSummaryTags({ dataview, availableFields }: LayerPanelProps) {
  const { t } = useTranslation()
  const isGlobalReportsEnabled = useSelector(selectIsGlobalReportsEnabled)

  const [filtersUIOpen, setFiltersUIOpen] = useState(false)

  const onToggleFiltersUIOpen = () => {
    setFiltersUIOpen(!filtersUIOpen)
  }

  return (
    <div className={styles.row}>
      <div className={styles.content}>
        <span className={styles.dot} style={{ color: dataview.config?.color }} />
        <div className={styles.filters}>
          <DatasetFilterSource dataview={dataview} />
          <DatasetFlagField dataview={dataview} />
          {availableFields.map((field) => (
            <DatasetSchemaField
              key={field[0]}
              dataview={dataview}
              field={field[0] as SupportedDatasetSchema}
              label={t(field[1] as any, field[2])}
            />
          ))}
          {isGlobalReportsEnabled && (
            <ExpandedContainer
              onClickOutside={onToggleFiltersUIOpen}
              visible={filtersUIOpen}
              className={styles.expandedContainer}
              component={<Filters dataview={dataview} onConfirmCallback={onToggleFiltersUIOpen} />}
            >
              <IconButton
                icon={filtersUIOpen ? 'filter-on' : 'filter-off'}
                size="small"
                onClick={onToggleFiltersUIOpen}
                className="print-hidden"
                tooltip={
                  filtersUIOpen
                    ? t('layer.filterClose', 'Close filters UI')
                    : t('layer.filterOpen', 'Open filters UI')
                }
                tooltipPlacement="top"
              />
            </ExpandedContainer>
          )}
        </div>
      </div>
    </div>
  )
}
