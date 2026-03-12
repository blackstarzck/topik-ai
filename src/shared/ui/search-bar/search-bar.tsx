import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Modal, Select, Space } from 'antd';
import type { ChangeEvent, ReactNode } from 'react';
import { useState } from 'react';

import { toSearchPickerRange } from './search-bar-utils';

export type SearchBarOption = {
  label: string;
  value: string;
};

type SearchBarProps = {
  searchField: string;
  searchFieldOptions: SearchBarOption[];
  keyword: string;
  onSearchFieldChange: (value: string) => void;
  onKeywordChange: (event: ChangeEvent<HTMLInputElement>) => void;
  keywordPlaceholder?: string;
  detailTitle?: string;
  detailContent?: ReactNode;
  onReset?: () => void;
  summary?: ReactNode;
  fieldWidth?: number;
  keywordWidth?: number;
};

type SearchBarDetailFieldProps = {
  label: string;
  children: ReactNode;
};

type SearchBarDateRangeProps = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
};

export function SearchBar({
  searchField,
  searchFieldOptions,
  keyword,
  onSearchFieldChange,
  onKeywordChange,
  keywordPlaceholder = '검색...',
  detailTitle = '상세 검색',
  detailContent,
  onReset,
  summary,
  fieldWidth = 112,
  keywordWidth = 230
}: SearchBarProps): JSX.Element {
  const [detailOpen, setDetailOpen] = useState(false);
  const hasDetailControls = Boolean(detailContent) || Boolean(onReset);

  return (
    <>
      <div className="search-bar">
        <div className="search-bar-main">
          <Space.Compact className="search-bar-compact">
            <Select
              value={searchField}
              options={searchFieldOptions}
              onChange={onSearchFieldChange}
              style={{ width: fieldWidth }}
            />
            <Input
              allowClear
              value={keyword}
              onChange={onKeywordChange}
              placeholder={keywordPlaceholder}
              prefix={<SearchOutlined />}
              style={{ width: keywordWidth }}
            />
          </Space.Compact>
          {hasDetailControls ? (
            <Button
              className="search-bar-detail-trigger"
              icon={<FilterOutlined />}
              onClick={() => setDetailOpen(true)}
            >
              상세
            </Button>
          ) : null}
        </div>
        {summary ? <div className="search-bar-summary">{summary}</div> : null}
      </div>

      {hasDetailControls ? (
        <Modal
          open={detailOpen}
          title={detailTitle}
          onCancel={() => setDetailOpen(false)}
          footer={null}
          destroyOnClose={false}
          width={420}
        >
          <div className="search-bar-detail-content">
            {detailContent}
            {onReset ? (
              <Button block icon={<ReloadOutlined />} onClick={onReset}>
                필터 초기화
              </Button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function SearchBarDetailField({
  label,
  children
}: SearchBarDetailFieldProps): JSX.Element {
  return (
    <div className="search-bar-detail-field">
      <div className="search-bar-detail-label">{label}</div>
      {children}
    </div>
  );
}

export function SearchBarDateRange({
  startDate,
  endDate,
  onChange
}: SearchBarDateRangeProps): JSX.Element {
  return (
    <DatePicker.RangePicker
      allowClear
      style={{ width: '100%' }}
      value={toSearchPickerRange(startDate, endDate)}
      onChange={(dates) =>
        onChange(
          dates?.[0]?.format('YYYY-MM-DD') ?? '',
          dates?.[1]?.format('YYYY-MM-DD') ?? ''
        )
      }
    />
  );
}
