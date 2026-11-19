import { useCallback, useMemo, useReducer } from 'react';
import type {
  CourseFormState,
  CourseInstructorEntry,
  CourseTagSelection,
  InstructorRole,
  OutlineItem,
} from '../../../types/domain.ts';
import { isDirty } from '../../../domain/form.ts';
import {
  appendOutlineItem,
  moveOutlineItem,
  patchOutlineItem,
  removeOutlineItem,
} from '../../../domain/outline.ts';
import { addInstructor, normalizeOrder, promoteToMain, removeInstructor, setInstructorRole } from '../../../domain/instructors.ts';
import { toggleTag } from '../../../domain/tags.ts';
import type { Instructor } from '../../../types/domain.ts';

/** 编辑器可执行的动作 */
type Action =
  | { type: 'reset'; state: CourseFormState }
  | { type: 'patchBasic'; patch: Partial<Pick<CourseFormState, 'title' | 'subtitle' | 'categoryId' | 'deliveryMode' | 'visibility' | 'benefitMode' | 'coverUrl' | 'coverName'>> }
  | { type: 'setIntro'; html: string }
  | { type: 'outlineMove'; from: number; to: number }
  | { type: 'outlineAdd'; id: string }
  | { type: 'outlinePatch'; id: string; patch: Partial<Omit<OutlineItem, 'id'>> }
  | { type: 'outlineRemove'; id: string }
  | { type: 'outcomeAdd' }
  | { type: 'outcomePatch'; index: number; value: string }
  | { type: 'outcomeRemove'; index: number }
  | { type: 'instructorAdd'; instructor: Instructor; role: InstructorRole }
  | { type: 'instructorRemove'; instructorId: string }
  | { type: 'instructorRole'; instructorId: string; role: InstructorRole }
  | { type: 'instructorPromote'; instructorId: string }
  | { type: 'instructorMove'; from: number; to: number }
  | { type: 'tagToggle'; dimension: CourseTagSelection['dimension']; value: string };

function reducer(state: CourseFormState, action: Action): CourseFormState {
  switch (action.type) {
    case 'reset':
      return action.state;
    case 'patchBasic':
      return { ...state, ...action.patch };
    case 'setIntro':
      return { ...state, introHtml: action.html };
    case 'outlineMove':
      return { ...state, outline: moveOutlineItem(state.outline, action.from, action.to) };
    case 'outlineAdd':
      return { ...state, outline: appendOutlineItem(state.outline, action.id) };
    case 'outlinePatch':
      return { ...state, outline: patchOutlineItem(state.outline, action.id, action.patch) };
    case 'outlineRemove':
      return { ...state, outline: removeOutlineItem(state.outline, action.id) };
    case 'outcomeAdd':
      return { ...state, outcomes: [...state.outcomes, ''] };
    case 'outcomePatch':
      return { ...state, outcomes: state.outcomes.map((item, i) => (i === action.index ? action.value : item)) };
    case 'outcomeRemove':
      return { ...state, outcomes: state.outcomes.filter((_, i) => i !== action.index) };
    case 'instructorAdd': {
      const outcome = addInstructor(state.instructors, action.instructor, action.role);
      return outcome.ok ? { ...state, instructors: outcome.next } : state;
    }
    case 'instructorRemove':
      return { ...state, instructors: removeInstructor(state.instructors, action.instructorId) };
    case 'instructorRole':
      return { ...state, instructors: setInstructorRole(state.instructors, action.instructorId, action.role) };
    case 'instructorPromote':
      return { ...state, instructors: promoteToMain(state.instructors, action.instructorId) };
    case 'instructorMove': {
      const list: CourseInstructorEntry[] = [...state.instructors];
      if (action.from < 0 || action.from >= list.length) return state;
      const bounded = Math.max(0, Math.min(list.length - 1, action.to));
      const [moved] = list.splice(action.from, 1);
      list.splice(bounded, 0, moved);
      return { ...state, instructors: normalizeOrder(list) };
    }
    case 'tagToggle': {
      const outcome = toggleTag(state.tags, action.dimension, action.value);
      return outcome.ok ? { ...state, tags: outcome.next } : state;
    }
    default:
      return state;
  }
}

export interface CourseEditorApi {
  state: CourseFormState;
  dirty: boolean;
  reset: (next: CourseFormState) => void;
  patchBasic: (patch: Partial<CourseFormState>) => void;
  setIntro: (html: string) => void;
  moveOutline: (from: number, to: number) => void;
  addOutline: (id: string) => void;
  patchOutline: (id: string, patch: Partial<Omit<OutlineItem, 'id'>>) => void;
  removeOutline: (id: string) => void;
  addOutcome: () => void;
  patchOutcome: (index: number, value: string) => void;
  removeOutcome: (index: number) => void;
  addInstructor: (instructor: Instructor, role?: InstructorRole) => void;
  removeInstructor: (instructorId: string) => void;
  setInstructorRole: (instructorId: string, role: InstructorRole) => void;
  promoteInstructor: (instructorId: string) => void;
  moveInstructor: (from: number, to: number) => void;
  toggleTag: (dimension: CourseTagSelection['dimension'], value: string) => void;
}

/**
 * 课程编辑器的唯一状态源。表单初值（baseline）与当前值都在这里，
 * dirty 由二者比较得出，页面拦截、按钮可用态、保存后复位都读同一个值。
 */
export function useCourseEditor(initial: CourseFormState): CourseEditorApi {
  const [state, dispatch] = useReducer(reducer, initial);
  const [baseline, setBaseline] = useReducer(
    (_prev: CourseFormState, next: CourseFormState) => next,
    initial,
  );

  const dirty = useMemo(() => isDirty(baseline, state), [baseline, state]);

  const reset = useCallback((next: CourseFormState) => {
    setBaseline(next);
    dispatch({ type: 'reset', state: next });
  }, []);

  return {
    state,
    dirty,
    reset,
    patchBasic: useCallback((patch: Partial<CourseFormState>) => dispatch({ type: 'patchBasic', patch }), []),
    setIntro: useCallback((html: string) => dispatch({ type: 'setIntro', html }), []),
    moveOutline: useCallback((from: number, to: number) => dispatch({ type: 'outlineMove', from, to }), []),
    addOutline: useCallback((id: string) => dispatch({ type: 'outlineAdd', id }), []),
    patchOutline: useCallback((id: string, patch: Partial<Omit<OutlineItem, 'id'>>) => dispatch({ type: 'outlinePatch', id, patch }), []),
    removeOutline: useCallback((id: string) => dispatch({ type: 'outlineRemove', id }), []),
    addOutcome: useCallback(() => dispatch({ type: 'outcomeAdd' }), []),
    patchOutcome: useCallback((index: number, value: string) => dispatch({ type: 'outcomePatch', index, value }), []),
    removeOutcome: useCallback((index: number) => dispatch({ type: 'outcomeRemove', index }), []),
    addInstructor: useCallback((instructor: Instructor, role: InstructorRole = 'co_main') => dispatch({ type: 'instructorAdd', instructor, role }), []),
    removeInstructor: useCallback((instructorId: string) => dispatch({ type: 'instructorRemove', instructorId }), []),
    setInstructorRole: useCallback((instructorId: string, role: InstructorRole) => dispatch({ type: 'instructorRole', instructorId, role }), []),
    promoteInstructor: useCallback((instructorId: string) => dispatch({ type: 'instructorPromote', instructorId }), []),
    moveInstructor: useCallback((from: number, to: number) => dispatch({ type: 'instructorMove', from, to }), []),
    toggleTag: useCallback((dimension: CourseTagSelection['dimension'], value: string) => dispatch({ type: 'tagToggle', dimension, value }), []),
  };
}
