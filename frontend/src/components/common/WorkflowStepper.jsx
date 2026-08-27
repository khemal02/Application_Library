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
 * `humanize`. Ideas moved off this component in favor of an open review panel (see
 * pages/Ideas/IdeaPanelCard.jsx) — Suggestions is this component's only remaining caller now,
 * and keeps plain humanize() (not passing it).
 */
export default function WorkflowStepper({ steps, currentStatus, terminalNegative = ['rejected'], orientation = 'horizontal', renderStepExtra, labelFor = humanize }) {
  if (terminalNegative.includes(currentStatus)) {
    return <Alert severity="error">This item was <strong>{labelFor(currentStatus)}</strong></Alert>;
  }

  const activeIndex = steps.indexOf(currentStatus);
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
