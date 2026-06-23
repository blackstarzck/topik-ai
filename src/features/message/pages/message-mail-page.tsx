import { Segmented } from 'antd';
import { useState } from 'react';

import { AuthEmailPanel } from './auth-email-panel';
import { MessageChannelPage } from './message-channel-page';

type MailView = 'notification' | 'auth';

export default function MessageMailPage(): JSX.Element {
  const [view, setView] = useState<MailView>('notification');

  return (
    <div className="message-mail-page">
      <div style={{ padding: '16px 24px 0' }}>
        <Segmented<MailView>
          options={[
            { label: '알림 메일', value: 'notification' },
            { label: '인증 메일', value: 'auth' }
          ]}
          value={view}
          onChange={(value) => setView(value)}
        />
      </div>
      {view === 'notification' ? <MessageChannelPage channel="mail" /> : <AuthEmailPanel />}
    </div>
  );
}

