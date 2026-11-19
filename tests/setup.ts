import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setMockLatency } from '../src/api/courseApi.ts';

/**
 * 把 mock 接口的模拟网络延迟归零。
 *
 * 原因：页面用例里有「点保存 → 断言已保存」这类链路，原先靠 flush(10)（跑 10 次
 * setTimeout(0)）来等异步完成。setTimeout(0) 的实际间隔依平台而定：Windows 约 15ms
 * （10 次≈150ms，盖住 30ms 的 mock 延迟），而 Linux 容器上约 1ms（10 次≈10-30ms），
 * 只要机器稍慢或并行 worker 抢 CPU，断言就会读到保存还没返回的中间态 ——
 * 同一份代码在别人的干净环境里随机失败 1-2 条。归零延迟后等待不再依赖机器速度。
 *
 * 单测关注的是「保存后状态正确」，不是「mock 延迟像不像真实网络」，所以归零放这里。
 * AUDIT_MOCK_LATENCY 仅供健壮性实验（模拟慢机器）时覆盖。
 */
setMockLatency(Number(process.env.AUDIT_MOCK_LATENCY ?? 0));


// jsdom 没有 matchMedia / ResizeObserver，TDesign 的 Select、Dialog 等组件会读取它们。
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
}

if (!('IntersectionObserver' in window)) {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] { return []; }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IntersectionObserverStub });
}

if (!('scrollTo' in window)) {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * react-router 的数据路由在导航时会 `new Request(url, { signal })`。
 * jsdom 的 AbortSignal 与 Node undici 内部的 AbortSignal 不是同一个类，
 * 直接传会抛 "Expected signal to be an instance of AbortSignal" 并让导航中断。
 * 测试里没有 loader/fetch，把 signal 丢掉即可，不影响断言的路由状态。
 */
const NodeRequest = globalThis.Request;
if (typeof NodeRequest === 'function' && !(NodeRequest as { __patched?: boolean }).__patched) {
  class PatchedRequest extends NodeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init && init.signal) {
        const { signal: _dropped, ...rest } = init;
        super(input, rest);
        return;
      }
      super(input, init);
    }
  }
  (PatchedRequest as { __patched?: boolean }).__patched = true;
  Object.defineProperty(globalThis, 'Request', { writable: true, configurable: true, value: PatchedRequest });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});