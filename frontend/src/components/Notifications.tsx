import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  Chip,
  Stack,
  Paper,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle,
  Error,
  Warning,
  Info,
  MonetizationOn,
  AccountBalance,
  Payment,
  Schedule,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '../contexts/WebSocketContext';

const NotificationIcon: React.FC<{ type: string; severity?: string }> = ({ type, severity }) => {
  // Type-based icons
  if (type.includes('loan:payment')) return <Payment color="primary" />;
  if (type.includes('loan:application')) return <AccountBalance color="primary" />;
  if (type.includes('loan:')) return <MonetizationOn color="primary" />;
  if (type.includes('user:')) return <AccountBalance color="primary" />;
  if (type.includes('system:')) return <Info color="action" />;

  // Severity-based icons
  switch (severity) {
    case 'success':
      return <CheckCircle color="success" />;
    case 'error':
      return <Error color="error" />;
    case 'warning':
      return <Warning color="warning" />;
    default:
      return <Info color="info" />;
  }
};

const getSeverityColor = (severity?: string) => {
  switch (severity) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

export const Notifications: React.FC = () => {
  const { notifications, unreadCount, markNotificationAsRead, clearNotifications } = useWebSocket();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notificationId: string) => {
    markNotificationAsRead(notificationId);
  };

  const handleClearAll = () => {
    clearNotifications();
    handleClose();
  };

  const handleMarkAllAsRead = () => {
    notifications
      .filter(n => !n.read)
      .forEach(n => markNotificationAsRead(n.id));
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="large"
        aria-label={`${unreadCount} new notifications`}
        color="inherit"
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            width: 400,
            maxHeight: 600,
            overflow: 'visible',
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                color="error"
                variant="filled"
              />
            )}
          </Stack>
        </Box>

        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {notifications.map((notification) => (
                <MenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id)}
                  sx={{
                    py: 2,
                    px: 2,
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: notification.read ? 'action.hover' : 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    <NotificationIcon
                      type={notification.type}
                      severity={notification.severity}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                          {notification.title}
                        </Typography>
                        {!notification.read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                            }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5 }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                        >
                          {formatDistanceToNow(new Date(notification.timestamp), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </>
                    }
                  />
                </MenuItem>
              ))}
            </Box>

            <Divider />

            <Box sx={{ p: 1 }}>
              <Stack direction="row" spacing={1}>
                {unreadCount > 0 && (
                  <Button
                    size="small"
                    onClick={handleMarkAllAsRead}
                    sx={{ flexGrow: 1 }}
                  >
                    Mark all as read
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={handleClearAll}
                  sx={{ flexGrow: 1 }}
                  color="error"
                >
                  Clear all
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

// Notification Center Component (for dedicated page)
export const NotificationCenter: React.FC = () => {
  const { notifications, markNotificationAsRead, clearNotifications } = useWebSocket();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || !n.read
  );

  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const date = new Date(notification.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(notification);
    return acc;
  }, {} as Record<string, typeof notifications>);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">Notification Center</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant={filter === 'all' ? 'contained' : 'outlined'}
            onClick={() => setFilter('all')}
            size="small"
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'contained' : 'outlined'}
            onClick={() => setFilter('unread')}
            size="small"
          >
            Unread
          </Button>
          {notifications.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              onClick={clearNotifications}
              size="small"
            >
              Clear All
            </Button>
          )}
        </Stack>
      </Stack>

      {Object.entries(groupedNotifications).length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
            <Box key={date}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {date === new Date().toLocaleDateString() ? 'Today' : date}
              </Typography>
              <Stack spacing={1}>
                {dateNotifications.map((notification) => (
                  <Paper
                    key={notification.id}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    onClick={() => markNotificationAsRead(notification.id)}
                  >
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <NotificationIcon
                        type={notification.type}
                        severity={notification.severity}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                          <Typography variant="subtitle2">
                            {notification.title}
                          </Typography>
                          {!notification.read && (
                            <Chip
                              label="New"
                              size="small"
                              color="primary"
                              sx={{ height: 20 }}
                            />
                          )}
                          <Chip
                            label={notification.severity || 'info'}
                            size="small"
                            color={getSeverityColor(notification.severity) as any}
                            variant="outlined"
                            sx={{ height: 20 }}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDistanceToNow(new Date(notification.timestamp), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};