import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import humanize from '../../utils/humanize';

/**
 * `steps`: ordered array of the "happy path" statuses; `terminalNegative`: statuses shown as an
 * alert instead (e.g. rejected). `renderStepExtra(step)`: optional per-step extra content shown
 * under a step's label (MUI StepLabel's `optional` slot) — e.g. an assignee picker/name under an
 * "assigned" step. `labelFor(step)`: optional override for the printed step text, defaulting to
 * `humanize`. `activeStep`: optional explicit index, for a caller whose progress isn't one single
 * status string to look up in `steps` (e.g. change requests, where each stage tracks its own
 * status independently) — when given, it wins over `currentStatus`/`indexOf`, and `currentStatus`
 * only still matters for the `terminalNegative` check.
 */
export default function WorkflowStepper({
  steps, currentStatus, activeStep, terminalNegative = ['rejected'], orientation = 'horizontal', renderStepExtra, labelFor = humanize,
}) {
  if (currentStatus && terminalNegative.includes(currentStatus)) {
    return <Alert severity="error">This item was <strong>{labelFor(currentStatus)}</strong></Alert>;
  }

  const activeIndex = activeStep !== undefined ? activeStep : steps.indexOf(currentStatus);
  const vertical = orientation === 'vertical';

  return (
    <Box sx={vertical ? undefined : { overflowX: 'auto' }}>
      <Stepper
        activeStep={activeIndex}
        orientation={orientation}
        alternativeLabel={!vertical}
        sx={vertical ? undefined : { minWidth: 480 }}
      >
        {steps.map((step) => (
          <Step key={step}>
            <StepLabel optional={renderStepExtra ? renderStepExtra(step) : undefined}>{labelFor(step)}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
