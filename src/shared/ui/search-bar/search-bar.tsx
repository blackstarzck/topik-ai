import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Button,
  ConfigProvider,
  DatePicker,
  Input,
  Popover,
  Select,
  Space
} from 'antd';
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
  showSingleFieldSelect?: boolean;
  keyword: string;
  onSearchFieldChange: (value: string) => void;
  onKeywordChange: (event: ChangeEvent<HTMLInputElement>) => void;
  keywordPlaceholder?: string;
  detailTitle?: string;
  detailContent?: ReactNode;
  onApply?: () => void;
  onDetailOpenChange?: (open: boolean) => void;
  onReset?: () => void;
  extra?: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  fieldWidth?: number;
  keywordWidth?: number;
  hideSearchControls?: boolean;
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
  showSingleFieldSelect = false,
  keyword,
  onSearchFieldChange,
  onKeywordChange,
  keywordPlaceholder = '검색어...',
  detailTitle = '상세 검색',
  detailContent,
  onApply,
  onDetailOpenChange,
  onReset,
  extra,
  summary,
  actions,
  fieldWidth = 112,
  keywordWidth = 230,
  hideSearchControls = false
}: SearchBarProps): JSX.Element {
  const [detailOpen, setDetailOpen] = useState(false);
  const hasDetailControls = Boolean(detailContent) || Boolean(onReset);
  const hasSingleFieldOption = searchFieldOptions.length <= 1;
  const shouldShowFieldSelect = showSingleFieldSelect || !hasSingleFieldOption;

  const handleApply = (): void => {
    onApply?.();
    handleDetailOpenChange(false);
  };

  const handleDetailOpenChange = (open: boolean): void => {
    setDetailOpen(open);
    onDetailOpenChange?.(open);
  };

  return (
    <div className="search-bar">
      {hideSearchControls ? null : (
        <div className="search-bar-main">
          <Space.Compact className="search-bar-compact">
            {shouldShowFieldSelect ? (
              <Select
                value={searchField}
                options={searchFieldOptions}
                onChange={onSearchFieldChange}
                style={{ width: fieldWidth }}
              />
            ) : null}
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
            <Popover
              open={detailOpen}
              onOpenChange={handleDetailOpenChange}
              trigger="click"
              placement="bottomLeft"
              title={detailTitle}
              overlayClassName="search-bar-popover"
              content={
                <div className="search-bar-detail-content">
                  {detailContent}
                  <div className="search-bar-detail-actions">
                    {onReset ? (
                      <Button
                        className="search-bar-detail-reset"
                        icon={<ReloadOutlined />}
                        onClick={onReset}
                      >
                        필터 초기화
                      </Button>
                    ) : null}
                    <Button type="primary" onClick={handleApply}>
                      적용
                    </Button>
                  </div>
                </div>
              }
            >
              <Button
                className="search-bar-detail-trigger"
                icon={<FilterOutlined />}
              >
                상세
              </Button>
            </Popover>
          ) : null}
        </div>
      )}
      {extra ? <div className="search-bar-extra">{extra}</div> : null}
      {summary || actions ? (
        <div className="search-bar-side">
          {summary ? <div className="search-bar-summary">{summary}</div> : null}
          {actions ? (
            <ConfigProvider componentSize="large">
              <div className="search-bar-actions">{actions}</div>
            </ConfigProvider>
          ) : null}
        </div>
      ) : null}
    </div>
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

