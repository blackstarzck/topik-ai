export type AdminStatus = '\ud65c\uc131' | '\ube44\ud65c\uc131';

export type RoleKey =
  | 'SUPER_ADMIN'
  | 'OPS_ADMIN'
  | 'CONTENT_MANAGER'
  | 'CS_MANAGER'
  | 'READ_ONLY';

export type PermissionRisk = 'low' | 'medium' | 'high';

export type PermissionDefinition = {
  key: string;
  name: string;
  module: string;
  scopeDescription: string;
  risk: PermissionRisk;
};

export type RoleDefinition = {
  key: RoleKey;
  name: string;
  description: string;
  defaultPermissions: string[];
};

export type AdminPermissionAssignment = {
  adminId: string;
  name: string;
  status: AdminStatus;
  lastLoginAt: string;
  role: RoleKey;
  permissions: string[];
  updatedAt: string;
  updatedBy: string;
};

export type PermissionAuditEvent = {
  id: string;
  targetType: 'Admin';
  targetId: string;
  action: '\uad8c\ud55c \ubd80\uc5ec' | '\uad8c\ud55c \uc218\uc815' | '\uad8c\ud55c \ud68c\uc218';
  reason: string;
  changedBy: string;
  beforeRole: RoleKey;
  afterRole: RoleKey;
  beforePermissions: string[];
  afterPermissions: string[];
  createdAt: string;
};

export const permissionCatalog: PermissionDefinition[] = [
  {
    key: 'dashboard.read',
    name: '\ub300\uc2dc\ubcf4\ub4dc \uc870\ud68c',
    module: '\ub300\uc2dc\ubcf4\ub4dc',
    scopeDescription: '\ub300\uc2dc\ubcf4\ub4dc \uc694\uc57d \uc704\uc82f\uc744 \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'low'
  },
  {
    key: 'users.read',
    name: '\ud68c\uc6d0 \uc870\ud68c',
    module: '\ud68c\uc6d0',
    scopeDescription: '\ud68c\uc6d0 \ubaa9\ub85d\uacfc \uc0c1\uc138 \ud0ed\uc744 \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'low'
  },
  {
    key: 'users.groups.manage',
    name: '\uac15\uc0ac \uad00\ub9ac',
    module: '\ud68c\uc6d0',
    scopeDescription: '\uac15\uc0ac \uad00\ub9ac \ud654\uba74\uc5d0\uc11c \ud560\ub2f9/\uc0c1\ud0dc \uc870\uce58\ub97c \uc218\ud589\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'users.referrals.manage',
    name: '\ucd94\ucc9c\uc778 \uad00\ub9ac',
    module: '\ud68c\uc6d0',
    scopeDescription: '\ucd94\ucc9c\uc778 \uc815\ubcf4\uc640 \ubcf4\uc0c1 \uad00\ub828 \uc870\uce58\ub97c \uc218\ud589\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'community.posts.hide',
    name: '\uac8c\uc2dc\uae00 \uc228\uae40',
    module: '\ucee4\ubba4\ub2c8\ud2f0',
    scopeDescription: '\uc2e0\uace0 \ub610\ub294 \uc815\ucc45 \uc0ac\uc720\ub85c \uac8c\uc2dc\uae00\uc744 \uc228\uae40 \ucc98\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'community.posts.delete',
    name: '\uac8c\uc2dc\uae00 \uc0ad\uc81c',
    module: '\ucee4\ubba4\ub2c8\ud2f0',
    scopeDescription: '\ucee4\ubba4\ub2c8\ud2f0 \uac8c\uc2dc\uae00\uc744 \uc601\uad6c \uc0ad\uc81c\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'community.reports.resolve',
    name: '\uc2e0\uace0 \ucc98\ub9ac',
    module: '\ucee4\ubba4\ub2c8\ud2f0',
    scopeDescription: '\uc2e0\uace0 \uac74\uc744 \ud655\uc778\ud558\uace0 \ucc98\ub9ac \uacb0\uacfc\ub97c \uae30\ub85d\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'message.mail.manage',
    name: '\uba54\uc77c \ubc1c\uc1a1 \uad00\ub9ac',
    module: '\uba54\uc2dc\uc9c0',
    scopeDescription: '\uba54\uc77c \ud15c\ud50c\ub9bf\uc774\ub098 \uc790\ub3d9 \ubc1c\uc1a1\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'message.push.manage',
    name: '\ud478\uc2dc \ubc1c\uc1a1 \uad00\ub9ac',
    module: '\uba54\uc2dc\uc9c0',
    scopeDescription: '\ud478\uc2dc \ud15c\ud50c\ub9bf\uc774\ub098 \uc790\ub3d9 \ubc1c\uc1a1\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'message.groups.manage',
    name: '\ub300\uc0c1 \uadf8\ub8f9 \uad00\ub9ac',
    module: '\uba54\uc2dc\uc9c0',
    scopeDescription: '\ub300\uc0c1 \uadf8\ub8f9 \uc138\uadf8\uba3c\ud2b8\uc640 \ubc1c\uc1a1 \uc870\uac74\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'message.history.read',
    name: '\ubc1c\uc1a1 \uc774\ub825 \uc870\ud68c',
    module: '\uba54\uc2dc\uc9c0',
    scopeDescription: '\uba54\uc77c/\ud478\uc2dc/\uadf8\ub8f9 \ubc1c\uc1a1 \uc774\ub825\uc744 \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'low'
  },
  {
    key: 'operation.notices.manage',
    name: '\uacf5\uc9c0\uc0ac\ud56d \uad00\ub9ac',
    module: '\uc6b4\uc601',
    scopeDescription: '\uacf5\uc9c0\uc0ac\ud56d \ub4f1\ub85d/\uc218\uc815/\uac8c\uc2dc \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'operation.faq.manage',
    name: 'FAQ \uad00\ub9ac',
    module: '\uc6b4\uc601',
    scopeDescription: 'FAQ \ucf58\ud150\uce20\uc640 \ub178\ucd9c \ud050\ub808\uc774\uc158\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'operation.events.manage',
    name: '\uc774\ubca4\ud2b8 \uad00\ub9ac',
    module: '\uc6b4\uc601',
    scopeDescription: '\uc774\ubca4\ud2b8 \uc815\ucc45 \ubc0f \ub178\ucd9c \uc77c\uc815\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'operation.policies.manage',
    name: '\uc815\ucc45 \uad00\ub9ac',
    module: '\uc6b4\uc601',
    scopeDescription: '\uc57d\uad00/\uc815\ucc45 \ubb38\uc11c\uc758 \ubc84\uc804\uacfc \uac8c\uc2dc \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'operation.chatbot.manage',
    name: '\ucc57\ubd07 \uc124\uc815',
    module: '\uc6b4\uc601',
    scopeDescription: '\uc6b4\uc601 \ucc57\ubd07 \uc2dc\ub098\ub9ac\uc624\uc640 \uc804\ud658 \uc870\uac74\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'commerce.payments.read',
    name: '\uacb0\uc81c \ub0b4\uc5ed \uc870\ud68c',
    module: '\ucee4\uba38\uc2a4',
    scopeDescription: '\uacb0\uc81c \ub0b4\uc5ed\uacfc \uc0c1\uc138 \uacb0\uc81c \uc815\ubcf4\ub97c \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'low'
  },
  {
    key: 'commerce.refunds.approve',
    name: '\ud658\ubd88 \uc2b9\uc778',
    module: '\ucee4\uba38\uc2a4',
    scopeDescription: '\ud658\ubd88 \uc694\uccad\uc744 \uc2b9\uc778/\ubc18\ub824\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'commerce.coupons.manage',
    name: '\ucfe0\ud3f0 \uad00\ub9ac',
    module: '\ucee4\uba38\uc2a4',
    scopeDescription: '\ucfe0\ud3f0\uacfc \uc815\uae30 \ucfe0\ud3f0 \ud15c\ud50c\ub9bf\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'commerce.points.manage',
    name: '\ud3ec\uc778\ud2b8 \uad00\ub9ac',
    module: '\ucee4\uba38\uc2a4',
    scopeDescription: '\ud3ec\uc778\ud2b8 \uc815\ucc45\uacfc \uc870\uc815 \uad8c\ud55c\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'commerce.store.manage',
    name: '\uc774\ucee4\uba38\uc2a4 \uad00\ub9ac',
    module: '\ucee4\uba38\uc2a4',
    scopeDescription: '\uc0c1\ud488/\ud328\ud0a4\uc9c0 \ud310\ub9e4 \uad6c\uc131\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'assessment.question-bank.manage',
    name: '\ubb38\uc81c\uc740\ud589 \uad00\ub9ac',
    module: '\ud3c9\uac00',
    scopeDescription: '\ubb38\ud56d \ud480\uacfc \ucd9c\uc81c \uae30\uc900\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'assessment.eps-topik.manage',
    name: 'EPS TOPIK \uad00\ub9ac',
    module: '\ud3c9\uac00',
    scopeDescription: 'EPS TOPIK \uc804\uc6a9 \uc2dc\ud5d8 \uad6c\uc131\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'assessment.level-tests.manage',
    name: '\ub808\ubca8 \ud14c\uc2a4\ud2b8 \uad00\ub9ac',
    module: '\ud3c9\uac00',
    scopeDescription: '\ub808\ubca8 \ud14c\uc2a4\ud2b8 \uc138\ud2b8\uacfc \uacb0\uacfc \uae30\uc900\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.library.manage',
    name: '\ucf58\ud150\uce20 \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\ucf58\ud150\uce20 \uce74\ud0c8\ub85c\uadf8\uc640 \ub178\ucd9c \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.badges.manage',
    name: '\ubc30\uc9c0 \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\ubc30\uc9c0 \uc815\uc758\uc640 \ud68d\ub4dd \uc870\uac74\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.manage',
    name: '\ub2e8\uc5b4\uc7a5 \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\ub2e8\uc5b4\uc7a5 \uc0c1\uc704 \uce74\ud14c\uace0\ub9ac\uc640 \uc6b4\uc601 \uba54\ud0c0\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.sonagi.manage',
    name: '\uc18c\ub098\uae30 \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\uc18c\ub098\uae30 \uc720\ud615 \ucf58\ud150\uce20\uc640 \ucd9c\uc81c \uaddc\uce59\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.multiple-choice.manage',
    name: '\uac1d\uad00\uc2dd \uc120\ud0dd \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\uac1d\uad00\uc2dd \uc120\ud0dd \uc720\ud615 \ucf58\ud150\uce20\uc640 \ubcf4\uae30 \uc815\ucc45\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'content.missions.manage',
    name: '\ud559\uc2b5 \ubbf8\uc158 \uad00\ub9ac',
    module: '\ucf58\ud150\uce20',
    scopeDescription: '\ubbf8\uc158 \uad6c\uc131\uacfc \ubcf4\uc0c1 \uad6c\uc131\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'analytics.read',
    name: '\ud1b5\uacc4 \uc870\ud68c',
    module: '\ud1b5\uacc4',
    scopeDescription: '\uc8fc\uc694 \uc9c0\ud45c\uc640 \ubcf4\ub4dc \uc9c0\ud45c\ub97c \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'low'
  },
  {
    key: 'system.admins.manage',
    name: '\uad00\ub9ac\uc790 \uacc4\uc815 \uad00\ub9ac',
    module: '\uc2dc\uc2a4\ud15c',
    scopeDescription: '\uad00\ub9ac\uc790 \uacc4\uc815 \uc5ed\ud560\uacfc \uc0c1\ud0dc\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'system.permissions.manage',
    name: '\uad8c\ud55c \uad00\ub9ac',
    module: '\uc2dc\uc2a4\ud15c',
    scopeDescription: '\uad00\ub9ac\uc790 \uad8c\ud55c \ubd80\uc5ec/\uc218\uc815/\ud68c\uc218 \uc870\uce58\ub97c \uc218\ud589\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'system.metadata.manage',
    name: '\uba54\ud0c0\ub370\uc774\ud130 \uad00\ub9ac',
    module: '\uc2dc\uc2a4\ud15c',
    scopeDescription: '\uc6b4\uc601 \ucf54\ub4dc \ud14c\uc774\ube14, \ub178\ucd9c \uaddc\uce59, \uc138\uadf8\uba3c\ud2b8 \ud544\ub4dc \uba54\ud0c0\ub370\uc774\ud130\ub97c \uad00\ub9ac\ud569\ub2c8\ub2e4.',
    risk: 'high'
  },
  {
    key: 'system.audit.read',
    name: '\uac10\uc0ac \ub85c\uadf8 \uc870\ud68c',
    module: '\uc2dc\uc2a4\ud15c',
    scopeDescription: '\uad00\ub9ac\uc790 \uc870\uce58 \uc774\ub825\uc744 \uac10\uc0ac \ub85c\uadf8\uc5d0\uc11c \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  },
  {
    key: 'system.logs.read',
    name: '\uc2dc\uc2a4\ud15c \ub85c\uadf8 \uc870\ud68c',
    module: '\uc2dc\uc2a4\ud15c',
    scopeDescription: '\uae30\uc220 \ub85c\uadf8 \ubc0f \uc7a5\uc560 \ud0d0\uc9c0 \uc815\ubcf4\ub97c \uc870\ud68c\ud569\ub2c8\ub2e4.',
    risk: 'medium'
  }
];

const allPermissionKeys = permissionCatalog.map((permission) => permission.key);

export const roleCatalog: RoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: '\uc288\ud37c \uad00\ub9ac\uc790',
    description: '\uc2dc\uc2a4\ud15c \uc804\uccb4 \uad8c\ud55c\uacfc \ubc30\ud3ec/\uc870\uce58 \ucd94\uc801 \ucc45\uc784\uc744 \uac00\uc9d1\ub2c8\ub2e4.',
    defaultPermissions: allPermissionKeys
  },
  {
    key: 'OPS_ADMIN',
    name: '\uc6b4\uc601 \uad00\ub9ac\uc790',
    description: '\ud68c\uc6d0, \uba54\uc2dc\uc9c0, \uc6b4\uc601, \ucee4\uba38\uc2a4 \uc6b4\uc601\uc744 \ub2f4\ub2f9\ud569\ub2c8\ub2e4.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.groups.manage',
      'users.referrals.manage',
      'community.posts.hide',
      'community.posts.delete',
      'community.reports.resolve',
      'message.mail.manage',
      'message.push.manage',
      'message.groups.manage',
      'message.history.read',
      'operation.notices.manage',
      'operation.faq.manage',
      'operation.events.manage',
      'operation.policies.manage',
      'operation.chatbot.manage',
      'commerce.payments.read',
      'commerce.refunds.approve',
      'commerce.coupons.manage',
      'commerce.points.manage',
      'commerce.store.manage',
      'analytics.read',
      'system.metadata.manage',
      'system.audit.read'
    ]
  },
  {
    key: 'CONTENT_MANAGER',
    name: '\ucf58\ud150\uce20 \uad00\ub9ac\uc790',
    description: '\ud3c9\uac00/\ucf58\ud150\uce20 \ub3c4\uba54\uc778\uc758 \uc6b4\uc601 \uad6c\uc131\uc744 \ub2f4\ub2f9\ud569\ub2c8\ub2e4.',
    defaultPermissions: [
      'dashboard.read',
      'operation.faq.manage',
      'assessment.question-bank.manage',
      'assessment.eps-topik.manage',
      'assessment.level-tests.manage',
      'content.library.manage',
      'content.badges.manage',
      'content.vocabulary.manage',
      'content.vocabulary.sonagi.manage',
      'content.vocabulary.multiple-choice.manage',
      'content.missions.manage',
      'analytics.read',
      'system.audit.read'
    ]
  },
  {
    key: 'CS_MANAGER',
    name: 'CS \ub2f4\ub2f9\uc790',
    description: '\ud68c\uc6d0 \ubb38\uc758, \uc2e0\uace0, FAQ \uc6b4\uc601\uc744 \ub2f4\ub2f9\ud569\ub2c8\ub2e4.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'community.reports.resolve',
      'message.history.read',
      'operation.notices.manage',
      'operation.faq.manage',
      'analytics.read',
      'system.audit.read'
    ]
  },
  {
    key: 'READ_ONLY',
    name: '\uc870\ud68c \uc804\uc6a9',
    description: '\uc870\ud68c \uc804\uc6a9\uc73c\ub85c \uad00\ub9ac \ud654\uba74\uc744 \ud655\uc778\ud569\ub2c8\ub2e4.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'message.history.read',
      'commerce.payments.read',
      'analytics.read',
      'system.audit.read',
      'system.logs.read'
    ]
  }
];
