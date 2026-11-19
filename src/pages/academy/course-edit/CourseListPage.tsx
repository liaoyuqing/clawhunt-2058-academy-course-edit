import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Tag } from 'tdesign-react';
import { AddIcon, EditIcon } from 'tdesign-icons-react';
import type { CourseRecord } from '../../../types/domain.ts';
import { C_DRAFT_ID, C_PUBLISHED_ID, readCourse } from '../../../mocks/courses.ts';

/**
 * 课程列表入口。仅用于从"列表"进入编辑页，让"返回列表"的离开拦截可被演示；
 * 真实环境这个列表由工作台框架（S2-WB）提供。
 */
export function CourseListPage() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);

  useEffect(() => {
    const list: CourseRecord[] = [];
    for (const id of [C_DRAFT_ID, C_PUBLISHED_ID]) {
      const record = readCourse(id);
      if (record) list.push(record);
    }
    setCourses(list);
  }, []);

  return (
    <div className="list-page" data-testid="course-list">
      <header className="list-page__head">
        <div>
          <h1>学院课程</h1>
          <p>工作台 · 学院 · 课程管理（列表为 mock，真实环境由工作台框架提供）</p>
        </div>
        <Link to="/academy/courses/new" className="list-page__new">
          <Button theme="primary"><AddIcon /> 新建课程</Button>
        </Link>
      </header>

      <table className="list-page__table">
        <thead>
          <tr>
            <th>课程标题</th>
            <th>状态</th>
            <th>页签</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id} data-course-id={course.id}>
              <td>{course.title}</td>
              <td>
                <Tag theme={course.status === 'published' ? 'success' : 'warning'} variant="light" size="small">
                  {course.status === 'published' ? '已发布' : '草稿'}
                </Tag>
              </td>
              <td>
                <Link to={'/academy/courses/' + course.id + '/edit'} className="list-page__edit" data-testid={'edit-' + course.id}>
                  <EditIcon /> 编辑
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CourseListPage;
