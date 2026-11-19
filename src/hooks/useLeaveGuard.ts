import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export interface LeaveGuard {
  /** 路由层拦截是否已触发（真路由跳转，含浏览器前进后退） */
  blocked: boolean;
  /** 放行当前被拦截的跳转 */
  proceed: () => void;
  /** 取消跳转，留在当前页 */
  reset: () => void;
}

/**
 * 未保存修改的离开拦截，两个通道同时生效：
 * 1. useBlocker 拦真实的客户端路由跳转（含浏览器前进/后退、页面内返回链接）；
 * 2. beforeunload 拦刷新/关闭标签页/直接改地址栏，浏览器弹原生的确认框。
 * dirty 从 false 变 true 后才注册，避免用户什么都没改也触发原生提示。
 */
export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const blocker = useBlocker(
    useCallback(({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
      return dirty && currentLocation.pathname !== nextLocation.pathname;
    }, [dirty]),
  );

  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 现代浏览器只需要 returnValue 非空即弹出原生确认框
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    blocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    reset: () => blocker.reset?.(),
  };
}
