import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

export function formatUserDisplayName(userName: string, userId: string): string {
  const normalizedName = userName.trim();
  if (!normalizedName) {
    return userId;
  }

  return `${normalizedName} (${userId})`;
}

type UserNavigationLinkProps = {
  stopPropagation?: boolean;
  tab?: string;
  userId: string;
  userName: string;
  withId?: boolean;
};

export function UserNavigationLink({
  stopPropagation = false,
  tab = 'profile',
  userId,
  userName,
  withId = true
}: UserNavigationLinkProps): JSX.Element {
  const handleClick = stopPropagation
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
      }
    : undefined;

  return (
    <Link
      className="table-navigation-link"
      to={`/users/${userId}?tab=${tab}`}
      onClick={handleClick}
    >
      {withId ? formatUserDisplayName(userName, userId) : userName}
    </Link>
  );
}
