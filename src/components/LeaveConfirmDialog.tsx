import { Dialog } from 'tdesign-react';

export interface LeaveConfirmDialogProps {
  visible: boolean;
  /** 被拦截时想要去往的地址，用于文案 */
  targetPath?: string;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * 未保存修改的离开确认弹窗。
 * 两个按钮分别对应"留下"和"离开"两个分支，都带 data-testid 供录屏与单测定位。
 */
export function LeaveConfirmDialog({ visible, targetPath, onStay, onLeave }: LeaveConfirmDialogProps) {
  return (
    <Dialog
      visible={visible}
      header="有未保存的修改"
      mode="modal"
      closeOnOverlayClick={false}
      closeOnEscKeydown={false}
      onClose={onStay}
      footer={
        <div className="leave-dialog__footer">
          <button type="button" className="tdesign-btn tdesign-btn--default tdesign-btn--base" data-testid="leave-stay" onClick={onStay}>
            留下继续编辑
          </button>
          <button type="button" className="tdesign-btn tdesign-btn--danger tdesign-btn--base" data-testid="leave-confirm" onClick={onLeave}>
            放弃修改并离开
          </button>
        </div>
      }
      body={
        <div className="leave-dialog" data-testid="leave-dialog">
          <p className="leave-dialog__text">
            当前课程有尚未保存的修改。离开后这些修改会丢失，确定要离开吗？
          </p>
          <ul className="leave-dialog__hints">
            <li>选择「留下继续编辑」回到表单，修改仍然保留。</li>
            <li>选择「放弃修改并离开」会丢弃本次修改{targetPath ? '，并前往 ' + targetPath : ''}。</li>
            <li>若想保留修改，请先点「保存草稿」。</li>
          </ul>
        </div>
      }
    />
  );
}

export default LeaveConfirmDialog;
